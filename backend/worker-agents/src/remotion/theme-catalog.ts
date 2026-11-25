/**
 * Pure TypeScript metadata & prompt catalog for the pre-built Vox and 3Blue1Brown
 * Remotion widget library (implemented in ./theme-widgets.tsx for browser bundling).
 */

export type StudioTheme = 'vox' | '3b1b';
export const CAPTION_SAFE_BOTTOM_PX = 140;

/** Concise reference injected into the Animation Agent's cached system prompt. */
export const THEME_WIDGET_CATALOG_DOCS = `
Pre-built Theme Widgets available via: import { ... } from './theme-widgets';
ALL layouts MUST keep bottom >= 140px clear for burned-in subtitles (CAPTION_SAFE_BOTTOM_PX = 140).

[VOX THEME]
- <VoxBackdrop bg="#F4ECD8"> — warm parchment paper grain & subtle vignette.
- <VoxHighlighterHeadline kicker="ACT I" words={['ROME','753','BCE']} highlightIndices={[1]} accent="#B8332A" fontSize={64} />
- <VoxGeoMap title="MEDITERRANEAN" territories={['italy','carthage','gaul','greece','west','east']} pins={[{x:455,y:285,label:'Rome'},{x:405,y:415,label:'Carthage'},{x:685,y:255,label:'Constantinople'}]} arrows={[{from:[300,190],to:[455,285]}]} splitEastWest={false} focus={{x:500,y:300,zoom:1.15}} width={860} height={520} />
  (Uses real accurate Mediterranean/Europe SVG coastlines in 1000x600 space! Key coordinates: Rome=[455,285], Carthage=[405,415], Gaul=[300,190], Greece=[585,305], Constantinople=[685,255], Egypt=[780,490], Britain=[240,85].)
- <VoxDataChart title="..." unit="%" labels={['...']} values={[10,40,90]} kind="bar"|"line" accent="#B8332A" width={780} height={380} />
- <VoxStatCard label="SENATE" value="300" delta="members" accent="#B8332A" width={420} />
- <VoxTimeline startLabel="753 BCE" endLabel="476 CE" currentLabel="44 BCE" progress={0.58} accent="#B8332A" /> (Pinned top-right, never overlaps subtitles!)

[3BLUE1BROWN THEME]
- <ThreeB1BBackdrop> — deep slate #0F111A + subtle #58C4DD coordinate grid.
- <ThreeB1BPlane vectors={[{x:3,y:2,color:'#FFFF00',label:'v'}]} width={760} height={500} />
- <ThreeB1BEquation terms={[{text:'e^{iπ}',color:'#58C4DD'},{text:'+ 1 = 0',color:'#ECEFF4'}]} fontSize={54} />
`.trim();
