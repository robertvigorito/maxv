"""Development commands for running maxv services."""

import platform
import shutil
import signal
import subprocess
from pathlib import Path

import typer

app = typer.Typer(help="Run maxv development services.")
PROJECT_ROOT = Path(__file__).resolve().parents[2]

KILL_PATTERNS = [
    "uvicorn backend.app.main:app",
    "vite",
    "maxv-player",
]


def run_process(command: list[str], cwd: Path = PROJECT_ROOT) -> None:
    """Run a service until it exits or is interrupted."""
    try:
        subprocess.run(command, cwd=cwd, check=False)
    except KeyboardInterrupt:
        pass


@app.command()
def backend() -> None:
    """Start the FastAPI backend."""
    run_process(["python", "-m", "uvicorn", "backend.app.main:app", "--reload"])


@app.command()
def frontend() -> None:
    """Start the Vite frontend."""
    run_process(["npm", "run", "dev"], cwd=PROJECT_ROOT / "frontend")


@app.command()
def player() -> None:
    """Build and start the native Rust/libVLC player."""
    run_process(
        ["cargo", "run", "--manifest-path", str(PROJECT_ROOT / "native/player/Cargo.toml"), "--"], cwd=PROJECT_ROOT
    )


@app.command()
def start() -> None:
    """Start MongoDB, the backend, and the frontend."""
    if shutil.which("docker") is None:
        raise typer.BadParameter("Docker is required to start MongoDB.")

    existing = subprocess.run(
        ["docker", "ps", "--filter", "name=maxv-mongo", "--filter", "status=running", "-q"],
        check=False,
        capture_output=True,
        text=True,
    )
    if not existing.stdout.strip():
        container = subprocess.run(
            ["docker", "compose", "up", "-d", "mongodb"],
            check=False,
            capture_output=True,
            text=True,
        )
        if container.returncode != 0:
            typer.echo(container.stderr, err=True)
            raise typer.Exit(container.returncode)

    both()


@app.command()
def kill() -> None:
    """Stop running maxv services (backend and frontend)."""
    system = platform.system()
    for pattern in KILL_PATTERNS:
        if system == "Windows":
            subprocess.run(
                ["taskkill", "/F", "/FI", f"WINDOWTITLE eq *{pattern}*"],
                check=False,
                capture_output=True,
            )
        else:
            subprocess.run(["pkill", "-f", pattern], check=False, capture_output=True)
    typer.echo("Stopped maxv services.")


@app.command()
def both() -> None:
    """Start the backend and frontend together."""
    processes = [
        subprocess.Popen(
            ["python", "-m", "uvicorn", "backend.app.main:app", "--reload"],
            cwd=PROJECT_ROOT,
        ),
        subprocess.Popen(["npm", "run", "dev"], cwd=PROJECT_ROOT / "frontend"),
    ]

    try:
        for process in processes:
            process.wait()
    except KeyboardInterrupt:
        for process in processes:
            process.send_signal(signal.SIGINT)
        for process in processes:
            process.wait()


def main() -> None:
    """Run the maxv development services."""
    app()


if __name__ == "__main__":
    main()
