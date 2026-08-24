"""Development commands for running maxv services."""

import platform
import signal
import subprocess
from pathlib import Path

import typer

app = typer.Typer(help="Run maxv development services.")
PROJECT_ROOT = Path(__file__).resolve().parents[2]

KILL_PATTERNS = [
    "uvicorn backend.app.main:app",
    "vite",
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
