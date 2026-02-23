import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';

interface Song {
  id: string;
  title: string;
  url: string;
}

interface Album {
  path?: string;
  title?: string;
  artist?: string;
  image?: string;
  songs?: Song[];
}

interface PlayerSong extends Song {
  artist: string;
  albumTitle: string;
  albumImage?: string;
}

interface PlayerAlbum {
  key: string;
  title: string;
  artist: string;
  image?: string;
  songs: PlayerSong[];
}

interface SongsManifest {
  baseUrl?: string;
  playerLogo?: string;
  albums?: Album[];
}

@Component({
  selector: 'app-mp3-player',
  standalone: true,
  templateUrl: './mp3-player.component.html',
  styleUrl: './mp3-player.component.css'
})
export class Mp3PlayerComponent {
  private readonly http = inject(HttpClient);
  private readonly audioPlayer = viewChild<ElementRef<HTMLAudioElement>>('audioPlayer');

  readonly albums = signal<PlayerAlbum[]>([]);
  readonly currentAlbumIndex = signal(0);
  readonly currentSongIndex = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly imageOverlay = signal<{ src: string; title: string } | null>(null);
  readonly playerLogo = signal<string | null>(null);
  readonly hasUserStartedPlayback = signal(false);
  readonly totalSongs = computed(() =>
    this.albums().reduce((count, album) => count + album.songs.length, 0)
  );

  readonly currentSong = computed<PlayerSong | null>(() => {
    const currentAlbum = this.albums()[this.currentAlbumIndex()];
    if (!currentAlbum || currentAlbum.songs.length === 0) {
      return null;
    }

    return currentAlbum.songs[this.currentSongIndex()] ?? null;
  });

  constructor() {
    this.loadSongs();
  }

  onTrackEnded(): void {
    if (this.totalSongs() === 0) {
      return;
    }

    this.playNext();
  }

  playSong(albumIndex: number, songIndex: number): void {
    console.log("albumIndex: ", albumIndex, "songIndex: ", songIndex);
    const album = this.albums()[albumIndex];
    if (!album || songIndex < 0 || songIndex >= album.songs.length) {
      return;
    }

    const selectedSong = album.songs[songIndex];
    this.currentAlbumIndex.set(albumIndex);
    this.currentSongIndex.set(songIndex);
    this.playCurrentSong(selectedSong);
  }

  playPrevious(): void {
    const albums = this.albums();
    if (albums.length === 0 || this.totalSongs() === 0) {
      return;
    }

    let albumIndex = this.currentAlbumIndex();
    let songIndex = this.currentSongIndex();

    if (songIndex > 0) {
      songIndex -= 1;
    } else {
      albumIndex = (albumIndex - 1 + albums.length) % albums.length;
      while (albums[albumIndex].songs.length === 0) {
        albumIndex = (albumIndex - 1 + albums.length) % albums.length;
      }
      songIndex = albums[albumIndex].songs.length - 1;
    }

    this.currentAlbumIndex.set(albumIndex);
    this.currentSongIndex.set(songIndex);
  }

  playNext(): void {
    const albums = this.albums();
    if (albums.length === 0 || this.totalSongs() === 0) {
      return;
    }

    let albumIndex = this.currentAlbumIndex();
    let songIndex = this.currentSongIndex();

    if (songIndex + 1 < albums[albumIndex].songs.length) {
      songIndex += 1;
    } else {
      albumIndex = (albumIndex + 1) % albums.length;
      while (albums[albumIndex].songs.length === 0) {
        albumIndex = (albumIndex + 1) % albums.length;
      }
      songIndex = 0;
    }

    this.currentAlbumIndex.set(albumIndex);
    this.currentSongIndex.set(songIndex);
  }

  openImageOverlay(src: string, title: string): void {
    this.imageOverlay.set({ src, title });
  }

  closeImageOverlay(): void {
    this.imageOverlay.set(null);
  }

  onAudioPlay(): void {
    if (!this.hasUserStartedPlayback()) {
      this.hasUserStartedPlayback.set(true);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.imageOverlay()) {
      this.closeImageOverlay();
    }
  }

  private loadSongs(): void {
    this.http.get<SongsManifest>('songs.json').subscribe({
      next: (data) => {
        try {
          if (!data?.albums || !Array.isArray(data.albums) || data.albums.length === 0) {
            throw new Error('Invalid songs manifest');
          }

          console.log('Loaded songs manifest:', data);
          this.playerLogo.set(
            data.playerLogo ? this.resolveUrl(data.baseUrl, undefined, data.playerLogo) : null
          );

          const resolvedAlbums = data.albums.map((album, albumIndex) => {
            if (!album?.songs || !Array.isArray(album.songs)) {
              return {
                key: `${albumIndex + 1}`,
                title: album?.title ?? `Album ${albumIndex + 1}`,
                artist: album?.artist ?? 'Unknown Artist',
                image: album?.image ? this.resolveUrl(data.baseUrl, undefined, album.image) : undefined,
                songs: []
              };
            }

            const title = album.title ?? `Album ${albumIndex + 1}`;
            const artist = album.artist ?? 'Unknown Artist';
            const image = album.image ? this.resolveUrl(data.baseUrl, undefined, album.image) : undefined;

            const songs = album.songs.map((song, songIndex) => {
              return {
                ...song,
                id: `${albumIndex + 1}-${song.id ?? songIndex + 1}`,
                artist,
                albumTitle: title,
                albumImage: image,
                url: this.resolveUrl(data.baseUrl, album.path, song.url)
              };
            });

            return {
              key: `${albumIndex + 1}-${title}`,
              title,
              artist,
              image,
              songs
            };
          });

          this.albums.set(resolvedAlbums);
          const firstAlbumIndex = resolvedAlbums.findIndex((album) => album.songs.length > 0);
          if (firstAlbumIndex >= 0) {
            this.currentAlbumIndex.set(firstAlbumIndex);
            this.currentSongIndex.set(0);
          }
        } catch {
          this.albums.set([]);
          this.playerLogo.set(null);
          this.error.set('songs.json has an invalid format.');
        } finally {
          console.log('Finally Resolved albums:', this.albums());
          this.loading.set(false);
          console.log('Loading state set to false::: ', this.loading());
        }
      },
      error: () => {
        this.albums.set([]);
        this.playerLogo.set(null);
        this.error.set('Could not load songs.json. Confirm the file exists in /public.');
        this.loading.set(false);
      }
    });
  }

  private resolveUrl(baseUrl: string | undefined, path: string | undefined, assetUrl: string): string {
    if (this.isAbsoluteUrl(assetUrl) || assetUrl.startsWith('/')) {
      return assetUrl;
    }

    const base = this.joinUrlParts(baseUrl, path);
    if (!base) {
      return assetUrl;
    }

    const normalizedBaseUrl = base.endsWith('/') ? base : `${base}/`;
    const normalizedAssetUrl = assetUrl.startsWith('/') ? assetUrl.slice(1) : assetUrl;
    return `${normalizedBaseUrl}${normalizedAssetUrl}`;
  }

  private isAbsoluteUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  private joinUrlParts(baseUrl?: string, path?: string): string {
    const parts = [baseUrl, path]
      .filter((part): part is string => Boolean(part))
      .map((part) => part.replace(/^\/+|\/+$/g, ''));

    if (parts.length === 0) {
      return '';
    }

    const hasLeadingSlash = baseUrl?.startsWith('/');
    const joined = parts.join('/');
    return hasLeadingSlash ? `/${joined}` : joined;
  }

  private playCurrentSong(song?: PlayerSong): void {
    const audio = this.audioPlayer()?.nativeElement;
    if (!audio) {
      return;
    }

    const selectedSong = song ?? this.currentSong();
    if (!selectedSong) {
      return;
    }

    audio.src = selectedSong.url;
    audio.load();
    audio.play().catch((error) => {
      console.log('Audio play blocked or failed:', error);
    });
  }
}
