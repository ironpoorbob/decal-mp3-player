import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { PlayerDataService } from '../services/player-data.service';

interface Artist {
  artistName: string;
  artistImage?: string;
  description?: string;
  albums: Album[];
}

interface Album {
  path: string;
  title: string;
  albumImage?: string;
  albumNotes?: string;
  image?: string;
  songs: Song[];
}

interface Song {
  id: string;
  title: string;
  url: string;
}

interface PlayerConfig {
  baseUrl: string;
  playerLogo: string;
  artists: PlayerArtist[];
}

interface PlayerArtist {
  artistName?: string;
  artistBaseUrl: string;
  songsManifest: string;
}



// this data is assembled from the player.json and artist songs.json
interface PlayerDataModel {
  playerBaseUrl: string;
  playerLogo: string;
  playerLogoUrl: string | null;
  artists: PlayerArtistData[];
}

interface PlayerArtistData {
  artistName?: string;
  artistImage?: string;
  description?: string;
  albums: Album[];
  artistBaseUrl: string;
  songsManifest: string;
}

interface BandInfoOverlayData {
  artistName: string;
  artistImage?: string;
  description?: string;
}

interface ArtistSongsManifest {
  artistName?: string;
  artistImage?: string;
  description?: string;
  artist?: {
    artistName?: string;
    artistImage?: string;
    description?: string;
  };
  albums: Album[];
}



// interface PlayerSong extends Song {
//   artistName: string;
//   albumTitle: string;
//   albumImage?: string;
// }

// interface PlayerAlbum {
//   key: string;
//   title: string;
//   artist: string;
//   image?: string;
//   artistImage?: string;
//   description?: string;
//   songs: PlayerSong[];
// }

// interface SongsManifest {
//   baseUrl?: string;
//   playerLogo?: string;
//   albums?: Album[];
// }

@Component({
  selector: 'app-mp3-player',
  standalone: true,
  templateUrl: './mp3-player.component.html',
  styleUrl: './mp3-player.component.css'
})
export class Mp3PlayerComponent {
  private readonly playerData = inject(PlayerDataService);
  private pendingArtistLoads = 0;

  mainPlayerData = signal<PlayerDataModel | null>(null);
  readonly currentAlbumIndex = signal(0);
  readonly currentSongIndex = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly hasUserStartedPlayback = signal(false);

  readonly imageOverlay = signal<{ src: string; title: string; notes?: string } | null>(null);
  readonly bandInfoOverlay = signal<BandInfoOverlayData | null>(null);
  readonly totalSongs = computed(() => {
    const data = this.mainPlayerData();
    if (!data) {
      return 0;
    }

    return data.artists.reduce((artistCount, artist) => {
      const artistSongs = artist.albums.reduce(
        (albumCount, album) => albumCount + album.songs.length,
        0
      );
      return artistCount + artistSongs;
    }, 0);
  });

  readonly allAlbums = computed(() => {
    const data = this.mainPlayerData();
    if (!data) {
      return [] as Album[];
    }
    return data.artists.flatMap((artist) => artist.albums);
  });

  readonly currentSong = computed<Song | null>(() => {
    const currentAlbum = this.allAlbums()[this.currentAlbumIndex()];
    if (!currentAlbum || currentAlbum.songs.length === 0) {
      return null;
    }

    return currentAlbum.songs[this.currentSongIndex()] ?? null;
  });

  readonly currentAlbumTitle = computed(() => {
    const currentAlbum = this.allAlbums()[this.currentAlbumIndex()];
    return currentAlbum?.title ?? '';
  });

  readonly currentArtistName = computed(() => {
    const data = this.mainPlayerData();
    if (!data) {
      return '';
    }
    const albumIndex = this.currentAlbumIndex();
    let running = 0;
    for (const artist of data.artists) {
      const next = running + artist.albums.length;
      if (albumIndex >= running && albumIndex < next) {
        return artist.artistName ?? 'Artist';
      }
      running = next;
    }
    return '';
  });

  constructor() {
    this.loadPlayerData();
  }

  onTrackEnded(): void {
    if (this.totalSongs() === 0) {
      return;
    }

    this.playNext();
  }

  playNext(): void {
    if (this.totalSongs() === 0) {
      return;
    }

    const albums = this.allAlbums();
    if (albums.length === 0) {
      return;
    }

    let albumIndex = this.currentAlbumIndex();
    let songIndex = this.currentSongIndex();

    if (albumIndex < 0 || albumIndex >= albums.length) {
      albumIndex = 0;
      songIndex = 0;
    }

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

  playPrevious(): void {
    if (this.totalSongs() === 0) {
      return;
    }

    const albums = this.allAlbums();
    if (albums.length === 0) {
      return;
    }

    let albumIndex = this.currentAlbumIndex();
    let songIndex = this.currentSongIndex();

    if (albumIndex < 0 || albumIndex >= albums.length) {
      albumIndex = 0;
      songIndex = 0;
    }

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

  playSong(artistIndex: number, albumIndex: number, songIndex: number): void {
    console.log('artistIndex:', artistIndex, 'albumIndex:', albumIndex, 'songIndex:', songIndex);
    const data = this.mainPlayerData();
    if (!data || artistIndex < 0 || artistIndex >= data.artists.length) {
      return;
    }

    const artist = data.artists[artistIndex];
    if (albumIndex < 0 || albumIndex >= artist.albums.length) {
      return;
    }

    const album = artist.albums[albumIndex];
    if (!album || songIndex < 0 || songIndex >= album.songs.length) {
      return;
    }

    const globalAlbumIndex =
      data.artists.slice(0, artistIndex).reduce((count, a) => count + a.albums.length, 0) + albumIndex;

    this.currentAlbumIndex.set(globalAlbumIndex);
    this.currentSongIndex.set(songIndex);
  }

  isSongActive(artistIndex: number, albumIndex: number, songIndex: number): boolean {
    const data = this.mainPlayerData();
    if (!data) {
      return false;
    }

    const globalAlbumIndex =
      data.artists.slice(0, artistIndex).reduce((count, artist) => count + artist.albums.length, 0) +
      albumIndex;

    return this.currentAlbumIndex() === globalAlbumIndex && this.currentSongIndex() === songIndex;
  }

  onAudioPlay(): void {
    if (!this.hasUserStartedPlayback()) {
      this.hasUserStartedPlayback.set(true);
    }
  }

  // image overlay functions
  openImageOverlay(src: string, title: string, notes?: string): void {
    this.imageOverlay.set({ src, title, notes });
  }

  closeImageOverlay(): void {
    this.imageOverlay.set(null);
  }

  openBandInfoOverlay(artist: PlayerArtistData): void {
    this.bandInfoOverlay.set({
      artistName: artist.artistName ?? 'Artist',
      artistImage: artist.artistImage,
      description: artist.description
    });
  }

  closeBandInfoOverlay(): void {
    this.bandInfoOverlay.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.imageOverlay()) {
      this.closeImageOverlay();
    }
    if (this.bandInfoOverlay()) {
      this.closeBandInfoOverlay();
    }
  }

  private loadPlayerData(): void {
    this.loading.set(true);
    this.error.set('');
    this.playerData.getJson<PlayerConfig>('player.json').subscribe({
      next: (config) => {
        console.log('Loaded player config:', config);

        this.mainPlayerData.set({
          playerBaseUrl: config.baseUrl,
          playerLogo: config.playerLogo,
          playerLogoUrl: config.playerLogo ? this.resolveUrl(config.baseUrl, undefined, config.playerLogo) : null,
          artists: config.artists.map((artist) => ({
            artistName: artist.artistName,
            artistBaseUrl: artist.artistBaseUrl,
            songsManifest: artist.songsManifest,
            albums: []
          }))
        });

        console.log('Player data model initialized:', this.mainPlayerData());

        // this.playerLogo.set(
        //   config.playerLogo ? this.resolveUrl(config.baseUrl, undefined, config.playerLogo) : null
        // );

        // Load artist data for each artist in the config
        this.pendingArtistLoads = config.artists.length;
        if (this.pendingArtistLoads === 0) {
          this.loading.set(false);
          return;
        }
        config.artists.forEach((artist) => {
          this.loadArtistData({
            artistName: artist.artistName,
            artistBaseUrl: artist.artistBaseUrl,
            songsManifest: artist.songsManifest,
            albums: []
          });
        });
      },
      error: () => {
        console.log('Could not load player.json.');
        this.error.set('Could not load player.json.');
        this.loading.set(false);
      }
    });
  }

  private loadArtistData(artist: PlayerArtistData): void {
    this.playerData.getJson<ArtistSongsManifest>(this.resolveUrl(artist.artistBaseUrl, undefined, artist.songsManifest)).subscribe({
      next: (data) => {
        console.log(`Loaded songs manifest for artist ${artist.artistName}:`, data);
        const currentData = this.mainPlayerData();
        if (currentData) {
          const resolvedArtistName =
            data.artistName ?? data.artist?.artistName ?? artist.artistName ?? 'Unknown Artist';
          const resolvedArtistImage = data.artistImage ?? data.artist?.artistImage;
          const resolvedDescription = data.description ?? data.artist?.description;

          const resolvedAlbums = data.albums.map((album) => ({
            ...album,
            albumImage: (album.albumImage ?? album.image)
              ? this.resolveUrl(artist.artistBaseUrl, undefined, album.albumImage ?? album.image ?? '')
              : undefined,
            songs: album.songs.map((song) => ({
              ...song,
              url: this.resolveUrl(artist.artistBaseUrl, album.path, song.url)
            }))
          }));

          const updatedArtists = currentData.artists.map((a) => {
            if (a.artistBaseUrl === artist.artistBaseUrl) {
              return {
                ...a,
                artistName: resolvedArtistName,
                artistImage: resolvedArtistImage
                  ? this.resolveUrl(artist.artistBaseUrl, undefined, resolvedArtistImage)
                  : a.artistImage,
                description: resolvedDescription ?? a.description,
                albums: resolvedAlbums
              };
            }
            return a;
          });
          this.mainPlayerData.set({ ...currentData, artists: updatedArtists });
          console.log('Updated player data model with artist albums:', this.mainPlayerData());
          console.log('total songs after loading artist data:', this.totalSongs());
        }
      },
      error: () => {
        console.error(`Failed to load songs manifest for artist ${artist.artistName} from URL: ${this.resolveUrl(artist.artistBaseUrl, undefined, artist.songsManifest)}`);
      },
      complete: () => {
        this.pendingArtistLoads -= 1;
        if (this.pendingArtistLoads <= 0) {
          this.loading.set(false);
        }
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

}
