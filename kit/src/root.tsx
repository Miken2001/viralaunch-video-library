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
import {Composition, continueRender, delayRender, registerRoot, staticFile, useVideoConfig} from 'remotion';
import {fontFaces} from './fonts';
import type {z} from 'zod';
import {MediaSchema, endCardFrames, type LibraryEntry, type Media} from './index';
import {LookCaptions} from './fx';
import {LookProvider, applyFontRoles, resolveLook} from './look';

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
  // With a shared look (multi-template sequences) the kit provides it to the entry and draws
  // the captions itself, so they are identical in every segment.
  const Component: React.FC<{media: Media; props: unknown}> = ({media, props}) => {
    const {fps, durationInFrames} = useVideoConfig();
    const look = React.useMemo(() => resolveLook(media.look, media.accent), [media.look, media.accent]);
    applyFontRoles(look);
    const resolved = React.useMemo(() => resolveAssets(media), [media]);
    const hold = look && entry.captionHold ? entry.captionHold({props: props as never, media, fps}) : 0;
    return (
      <LookProvider look={look}>
        <Inner media={resolved} props={props} />
        {look ? <LookCaptions media={resolved} hold={hold} until={Math.min(durationInFrames - endCardFrames(media, fps, durationInFrames), durationInFrames - Math.round((media.tailMs / 1000) * fps))} /> : null}
      </LookProvider>
    );
  };
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
