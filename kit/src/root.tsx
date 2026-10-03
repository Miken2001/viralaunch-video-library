/**
 * Registers ONE library entry as a Remotion composition. ViraLaunch's renderer and the
 * library's preview script both generate a two-line root file that calls this:
 *
 *   import entry from '<entry>/src/index';
 *   import {registerEntry} from '@viralaunch/kit/root';
 *   registerEntry(entry);
 *
 * Output size, fps and duration always come from `media`, so an entry never hard-codes them.
 */
import React from 'react';
import {Composition, continueRender, delayRender, registerRoot, staticFile} from 'remotion';
import {fontFaces} from './fonts';
import type {z} from 'zod';
import {MediaSchema, type LibraryEntry, type Media} from './index';

/**
 * ViraLaunch stages every asset into the render's public directory and passes bare file
 * names. Resolve them to served URLs here so entries never call staticFile themselves.
 * Anything that is not a plain staged name (a path escape, a scheme, an absolute path) is
 * rejected: entries must render from staged local files only.
 */
function local(value: string): string {
  if (!value) return '';
  if (value.includes('..') || /^(?:[a-z]+:|[\\/])/i.test(value)) throw new Error(`Invalid staged asset: ${value}`);
  return staticFile(value);
}

function resolveAssets(media: Media): Media {
  return {
    ...media,
    scenes: media.scenes.map(s => ({...s, video: local(s.video), audio: {...s.audio, url: local(s.audio.url)}})),
    music: media.music ? {...media.music, url: local(media.music.url)} : undefined,
    brand: {...media.brand, logo: local(media.brand.logo)},
  };
}

export function registerEntry<S extends z.ZodTypeAny>(entry: LibraryEntry<S>) {
  const Inner = entry.component as React.FC<{media: Media; props: unknown}>;
  const Component: React.FC<{media: Media; props: unknown}> = ({media, props}) => <Inner media={resolveAssets(media)} props={props} />;
  const Root: React.FC = () => (
    <Composition
      id={entry.id}
      component={Component}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{media: MediaSchema.parse({scenes: [{audio: {url: '', duration: 1}}], durationMs: 1000}), props: {}}}
      calculateMetadata={({props}) => {
        const media = MediaSchema.parse(props.media);
        const parsed = entry.schema.parse(props.props);
        return {
          durationInFrames: Math.max(1, Math.ceil((media.durationMs / 1000) * media.fps)),
          fps: media.fps,
          width: media.width,
          height: media.height,
          props: {media, props: parsed},
        };
      }}
    />
  );
  // Wait for every bundled font so no frame renders with a fallback face.
  if (typeof document !== 'undefined') {
    const handle = delayRender('Loading bundled fonts');
    Promise.all(fontFaces.map(face => document.fonts.load(face)))
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }
  registerRoot(Root);
}
