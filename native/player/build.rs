fn main() {
    pkg_config::Config::new()
        .atleast_version("3.0")
        .probe("libvlc")
        .expect("libVLC development files are required (install libvlc-dev libvlccore-dev)");
}