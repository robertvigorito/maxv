use std::ffi::{CString, NulError};
use std::io::{self, BufRead};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

#[allow(non_camel_case_types)]
type libvlc_instance_t = libc::c_void;
#[allow(non_camel_case_types)]
type libvlc_media_t = libc::c_void;
#[allow(non_camel_case_types)]
type libvlc_media_player_t = libc::c_void;

#[link(name = "vlc")]
extern "C" {
    fn libvlc_new(argc: libc::c_int, argv: *const *const libc::c_char) -> *mut libvlc_instance_t;
    fn libvlc_release(instance: *mut libvlc_instance_t);
    fn libvlc_media_new_path(instance: *mut libvlc_instance_t, path: *const libc::c_char) -> *mut libvlc_media_t;
    fn libvlc_media_release(media: *mut libvlc_media_t);
    fn libvlc_media_player_new_from_media(media: *mut libvlc_media_t) -> *mut libvlc_media_player_t;
    fn libvlc_media_player_release(player: *mut libvlc_media_player_t);
    fn libvlc_media_player_play(player: *mut libvlc_media_player_t) -> libc::c_int;
    fn libvlc_media_player_pause(player: *mut libvlc_media_player_t);
    fn libvlc_media_player_stop(player: *mut libvlc_media_player_t);
    fn libvlc_media_player_is_playing(player: *mut libvlc_media_player_t) -> libc::c_int;
    fn libvlc_media_player_get_time(player: *mut libvlc_media_player_t) -> libc::c_longlong;
    fn libvlc_media_player_set_time(player: *mut libvlc_media_player_t, time: libc::c_longlong);
    fn libvlc_media_player_get_length(player: *mut libvlc_media_player_t) -> libc::c_longlong;
}

struct Clip {
    path: String,
    in_ms: i64,
    out_ms: Option<i64>,
}

struct Player {
    instance: *mut libvlc_instance_t,
    current: Option<*mut libvlc_media_player_t>,
    clips: Vec<Clip>,
    index: usize,
}

unsafe impl Send for Player {}

impl Player {
    fn new(clips: Vec<Clip>) -> Result<Self, String> {
        let args = [CString::new("--quiet").map_err(error_text)?];
        let pointers = args.iter().map(|arg| arg.as_ptr()).collect::<Vec<_>>();
        let instance = unsafe { libvlc_new(pointers.len() as libc::c_int, pointers.as_ptr()) };
        if instance.is_null() {
            return Err("libVLC failed to initialize".into());
        }
        Ok(Self { instance, current: None, clips, index: 0 })
    }

    fn load(&mut self, index: usize, autoplay: bool) -> Result<(), String> {
        if index >= self.clips.len() {
            return Err("clip index is out of range".into());
        }
        self.stop_current();
        let clip = &self.clips[index];
        if !Path::new(&clip.path).exists() {
            return Err(format!("media does not exist: {}", clip.path));
        }
        let path = CString::new(clip.path.as_str()).map_err(error_text)?;
        let media = unsafe { libvlc_media_new_path(self.instance, path.as_ptr()) };
        if media.is_null() {
            return Err(format!("libVLC could not open: {}", clip.path));
        }
        let player = unsafe { libvlc_media_player_new_from_media(media) };
        unsafe { libvlc_media_release(media) };
        if player.is_null() {
            return Err("libVLC could not create a media player".into());
        }
        self.current = Some(player);
        self.index = index;
        if clip.in_ms > 0 {
            unsafe { libvlc_media_player_set_time(player, clip.in_ms); }
        }
        if autoplay && unsafe { libvlc_media_player_play(player) } != 0 {
            return Err("libVLC could not start playback".into());
        }
        Ok(())
    }

    fn stop_current(&mut self) {
        if let Some(player) = self.current.take() {
            unsafe {
                libvlc_media_player_stop(player);
                libvlc_media_player_release(player);
            }
        }
    }

    fn status(&self) -> String {
        let Some(player) = self.current else { return "status stopped".into(); };
        let time = unsafe { libvlc_media_player_get_time(player) };
        let length = unsafe { libvlc_media_player_get_length(player) };
        let playing = unsafe { libvlc_media_player_is_playing(player) } != 0;
        format!("status index={} time_ms={} length_ms={} playing={}", self.index, time, length, playing)
    }

    fn tick(&mut self) {
        let Some(player) = self.current else { return; };
        let time = unsafe { libvlc_media_player_get_time(player) };
        if self.clips[self.index].out_ms.is_some_and(|out| time >= out) {
            if self.index + 1 < self.clips.len() {
                let _ = self.load(self.index + 1, true);
            } else {
                self.stop_current();
                println!("ended");
            }
        }
    }

    fn command(&mut self, input: &str) -> bool {
        let mut parts = input.splitn(2, ' ');
        match parts.next().unwrap_or_default() {
            "play" => if let Some(player) = self.current { unsafe { libvlc_media_player_play(player); } },
            "pause" => if let Some(player) = self.current { unsafe { libvlc_media_player_pause(player); } },
            "stop" => self.stop_current(),
            "next" => { let _ = self.load(self.index + 1, true); }
            "previous" => if self.index > 0 { let _ = self.load(self.index - 1, true); },
            "seek" => if let Ok(ms) = parts.next().unwrap_or_default().parse() { if let Some(player) = self.current { unsafe { libvlc_media_player_set_time(player, ms); } } },
            "load" => if let Ok(index) = parts.next().unwrap_or_default().parse() { let _ = self.load(index, true); },
            "status" => println!("{}", self.status()),
            "quit" => return false,
            _ => println!("error unknown-command"),
        }
        true
    }
}

impl Drop for Player {
    fn drop(&mut self) {
        self.stop_current();
        unsafe { libvlc_release(self.instance); }
    }
}

fn error_text(error: NulError) -> String { format!("invalid media argument: {error}") }

fn main() -> Result<(), String> {
    let clips = std::env::args().skip(1).map(|path| Clip { path, in_ms: 0, out_ms: None }).collect();
    let player = Arc::new(Mutex::new(Player::new(clips)?));
    if player.lock().map_err(|_| "player lock poisoned")?.clips.len() > 0 {
        player.lock().map_err(|_| "player lock poisoned")?.load(0, true)?;
    }
    let ticker = Arc::clone(&player);
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(50));
        if let Ok(mut player) = ticker.lock() { player.tick(); }
    });
    for line in io::stdin().lock().lines() {
        if !player.lock().map_err(|_| "player lock poisoned")?.command(&line.map_err(|error| error.to_string())?) { break; }
    }
    Ok(())
}