"""Tests for the media scanner service."""

from pathlib import Path
import shutil

import pytest

from backend.app.services.scanner import MediaScanner


class TestMediaScanner:
    """Test MediaScanner class."""

    def test_is_supported_file(self):
        """Test supported file detection."""
        scanner = MediaScanner()

        assert scanner.is_supported_file(Path("test.jpg"))
        assert scanner.is_supported_file(Path("test.jpeg"))
        assert scanner.is_supported_file(Path("test.png"))
        assert scanner.is_supported_file(Path("test.exr"))
        assert scanner.is_supported_file(Path("test.mov"))
        assert scanner.is_supported_file(Path("TEST.JPG"))  # Case insensitive

        assert not scanner.is_supported_file(Path("test.txt"))
        assert not scanner.is_supported_file(Path("test.mp4"))
        assert not scanner.is_supported_file(Path("test.gif"))

    def test_is_video_file(self):
        """Test video file detection."""
        scanner = MediaScanner()

        assert scanner.is_video_file(Path("test.mov"))
        assert scanner.is_video_file(Path("TEST.MOV"))

        assert not scanner.is_video_file(Path("test.jpg"))
        assert not scanner.is_video_file(Path("test.png"))

    def test_calculate_file_hash(self, test_media_dir):
        """Test fast file hash calculation."""
        scanner = MediaScanner()

        # Create a test file
        test_file = test_media_dir / "test.txt"
        test_file.write_text("Hello, World!")

        # Calculate hash
        file_hash = scanner.calculate_file_hash(test_file)

        # Verify format
        assert file_hash.startswith("sha256:")

        # Verify hash is deterministic for the same file
        assert scanner.calculate_file_hash(test_file) == file_hash

        # Verify hash changes when the content changes
        test_file.write_text("Hello, World! 2")
        assert scanner.calculate_file_hash(test_file) != file_hash

    def test_scan_directory(self, test_media_dir):
        """Test directory scanning."""
        scanner = MediaScanner()

        # Create test files
        (test_media_dir / "image1.jpg").write_text("fake image")
        (test_media_dir / "image2.png").write_text("fake image")
        (test_media_dir / "video1.mov").write_text("fake video")
        (test_media_dir / "document.txt").write_text("not media")

        # Create subdirectory
        subdir = test_media_dir / "subdir"
        subdir.mkdir()
        (subdir / "image3.jpeg").write_text("fake image")

        # Scan directory
        files = scanner.scan_directory(test_media_dir, recursive=True)

        # Should find 4 media files (3 images + 1 video)
        assert len(files) == 4

        # Check that non-media file is excluded
        filenames = [f.name for f in files]
        assert "document.txt" not in filenames
        assert "image1.jpg" in filenames
        assert "image3.jpeg" in filenames

    def test_scan_directory_non_recursive(self, test_media_dir):
        """Test non-recursive directory scanning."""
        scanner = MediaScanner()

        # Create test files
        (test_media_dir / "image1.jpg").write_text("fake image")

        # Create subdirectory with file
        subdir = test_media_dir / "subdir"
        subdir.mkdir()
        (subdir / "image2.jpg").write_text("fake image")

        # Scan non-recursively
        files = scanner.scan_directory(test_media_dir, recursive=False)

        # Should only find top-level file
        assert len(files) == 1
        assert files[0].name == "image1.jpg"

    def test_scan_exr_sequence_fixture(self, test_media_dir):
        """Discover the committed EXR sequence and standalone image fixture."""
        fixture_dir = Path(__file__).parent / "fixtures" / "exr"
        for fixture in fixture_dir.glob("*.exr"):
            shutil.copy2(fixture, test_media_dir / fixture.name)

        scanner = MediaScanner()
        media_files = scanner.scan_directory(test_media_dir)
        sequences, standalone = scanner._group_sequences(media_files)

        assert len(media_files) == 4
        assert len(sequences) == 1
        assert sequences[0]["pattern"] == "beauty.%04d.exr"
        assert sequences[0]["count"] == 3
        assert sequences[0]["start"] == 1
        assert sequences[0]["end"] == 3
        assert [path.name for path in standalone] == ["still.exr"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
