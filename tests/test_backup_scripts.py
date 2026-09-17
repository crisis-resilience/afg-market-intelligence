"""Contract tests for the production backup and restore-check scripts."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parents[1]


def _fake_docker(bin_dir: Path) -> None:
    docker = bin_dir / "docker"
    docker.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
args="$*"
if [[ "$args" == *"pg_dump"* ]]; then
  printf 'fake-custom-format-archive'
elif [[ "$args" == *"psql"* ]]; then
  printf '4\\n'
else
  cat >/dev/null || true
fi
"""
    )
    docker.chmod(0o755)


def _environment(tmp_path: Path) -> dict[str, str]:
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "docker-compose.prod.yml").write_text("services: {}\n")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _fake_docker(bin_dir)
    return {
        **os.environ,
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "AFG_MARKET_DIR": str(repo),
        "AFG_MARKET_BACKUP_DIR": str(tmp_path / "backups"),
    }


def test_backup_creates_validated_archive_and_checksum(tmp_path: Path):
    env = _environment(tmp_path)

    result = subprocess.run(
        ["bash", str(REPO_ROOT / "deploy/vm/backup-db.sh")],
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    archives = list((tmp_path / "backups").glob("afg-market-*.dump"))
    assert len(archives) == 1
    assert archives[0].read_bytes() == b"fake-custom-format-archive"
    assert archives[0].with_suffix(".dump.sha256").is_file()
    assert "backup exists only on this VM" in result.stdout


def test_restore_check_uses_isolated_database_and_checks_core_tables(tmp_path: Path):
    env = _environment(tmp_path)
    archive = tmp_path / "backup.dump"
    archive.write_bytes(b"fake-custom-format-archive")

    result = subprocess.run(
        ["bash", str(REPO_ROOT / "deploy/vm/verify-backup.sh"), str(archive)],
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "restore verified successfully" in result.stdout


def test_deploy_refuses_secret_file_with_unsafe_permissions(tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text("POSTGRES_PASSWORD=a-secure-password-that-is-long\n")
    env_file.chmod(0o644)

    result = subprocess.run(
        ["bash", str(REPO_ROOT / "deploy/vm/deploy.sh")],
        env={**os.environ, "AFG_MARKET_DIR": str(tmp_path), "SSH_ORIGINAL_COMMAND": "a" * 40},
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode != 0
    assert ".env must have mode 600" in result.stderr


def test_deploy_refuses_placeholder_production_secrets(tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "POSTGRES_PASSWORD=postgres",
                "DATABASE_URL=postgresql://postgres:postgres@db:5432/afg_market",
                "COMTRADE_API_KEY=your_api_key_here",
                "SITE_ADDRESS=:80",
            ]
        )
    )
    env_file.chmod(0o600)

    result = subprocess.run(
        ["bash", str(REPO_ROOT / "deploy/vm/deploy.sh")],
        env={**os.environ, "AFG_MARKET_DIR": str(tmp_path), "SSH_ORIGINAL_COMMAND": "a" * 40},
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode != 0
    assert "POSTGRES_PASSWORD must be a non-default value" in result.stderr
