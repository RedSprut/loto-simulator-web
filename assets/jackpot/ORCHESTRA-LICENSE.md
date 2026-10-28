# Ceremony orchestra recording — rights and production record

- Work: Wolfgang Amadeus Mozart, *Le nozze di Figaro*, K. 492, overture (1786).
- Recording: Musopen Symphony / Czech National Symphony Orchestra, Musopen Kickstarter Project, 2012. The orchestra name and date are also embedded in the source FLAC tags.
- Composition: public domain (Mozart died in 1791).
- Recording: released into the public domain by Musopen. The asset record states a worldwide release and unconditional permission where dedication is not possible; its Public Domain Mark is not a new restrictive licence. No commercial stock recording or MIDI rendering is used.

## Verified sources (27 October 2026)

1. [Musopen's own completed-project release](https://musopen.org/uk/blog/musopen-kickstarter-project-1-complete/), dated 23 July 2014, specifically lists *Mozart — Marriage Of Figaro*, identifies its orchestra recordings, links the bulk releases, and permits sharing, editing, remixing and downloading.
2. [Musopen's work page](https://musopen.org/music/2682-the-marriage-of-figaro-k-492/).
3. [Exact FLAC asset and recording/composition rights](https://commons.wikimedia.org/w/index.php?title=File:Mozart_-_Le_nozze_di_Figaro,_K492_-_Overture_(Musopen_Symphony).flac&oldid=963510813), including the recording's worldwide author release, is a mirror of the Musopen collection. This is the specific file used, not a licence inferred from a score or an arbitrary user upload.
4. [Source collection](https://archive.org/details/MusopenCollectionAsFlac).
5. [Public Domain Mark](https://creativecommons.org/publicdomain/mark/1.0/).

Original download: `https://upload.wikimedia.org/wikipedia/commons/d/d2/Mozart_-_Le_nozze_di_Figaro%2C_K492_-_Overture_%28Musopen_Symphony%29.flac`.

Source SHA-1: `a2ba0ae7e7a7751b1c82263f9a4817d8c1bf7309`, verified against the asset metadata. Source: 48 kHz, stereo, 16-bit FLAC, 241 seconds.

Shipped file: `celebration-orchestra.mp3` — original recording at 211.000–239.400 seconds, exactly 28.4 seconds of programme, stereo 48 kHz / 192 kbps MP3. The excerpt retains the natural closing orchestral cadence and decay. Only an 80 ms entry fade, a 350 ms exit fade and -0.5 dB gain were applied; no notes, synthetic instruments, loops, tempo changes or dynamic compression were added. Original trailing silence beyond 239.4 seconds is omitted. The short ceremony plays the closing 5.3 seconds of this same file.

Shipped SHA-256: `285ddff7ae1d136ecf7820bd4facc74f30a8cd264d784ab3ac73cc701acaac13`.

Audio-transform command (FFmpeg temporary tooling; no project dependency; descriptive ID3 title/artist/composer/album/public-domain tags were also set):

```sh
ffmpeg -ss 211 -t 28.4 -i source.flac -map_metadata -1 \
  -af 'afade=t=in:st=0:d=0.08,afade=t=out:st=28.05:d=0.35,volume=-0.5dB' \
  -c:a libmp3lame -b:a 192k -ar 48000 -ac 2 celebration-orchestra.mp3
```

The original source's measured excerpt has mean -16.2 dBFS and peak -1.0 dBFS before these small fades/gain. Existing ceremony sound effects and the user-controlled mute/unmute button are retained. The recording is self-hosted and fetched only when sound is requested, never as part of startup or silent playback.
