import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { transform } from 'lightningcss';
import { describe,it,expect } from 'vitest';
import { Catalog } from '../components/catalog';
import { portfolio } from '../lib/site-content';
describe('catalog player',()=>{
 it('preserves the mobile dialog translation reset after CSS minification',()=>{
  const source=readFileSync('app/globals.css','utf8');
  const rule=source.match(/\.film-dialog-portrait\[data-slot=dialog-content\]\{([^}]*)\}/)?.[1];
  expect(rule).toBeDefined();
  const css=`@layer utilities{.film-dialog-portrait[data-slot=dialog-content]{translate:-50% -50%}}.film-dialog-portrait[data-slot=dialog-content]{${rule}}`;
  const compiled=transform({filename:'catalog.css',code:Buffer.from(css)}).code.toString();
  expect(compiled).toMatch(/translate:\s*0(?:px)?(?:\s+0(?:px)?)?\s*!important/);
 });
 it('shows the supplied client videos in the requested order with local browser-friendly media',()=>{
  expect(portfolio.map(({title,video,poster})=>({title,video,poster}))).toEqual([
   {title:'JAC Veracruz',video:'/media/jac-veracruz.mp4',poster:'/media/jac-veracruz-poster.jpg'},
   {title:'Hyper Vsa',video:'/media/hyper-vsa.mp4',poster:'/media/hyper-vsa-poster.jpg'},
   {title:'Day to night',video:'/media/day-to-night.mp4',poster:'/media/day-to-night-poster.jpg'},
  ]);
  render(<Catalog/>);
  expect(screen.getAllByRole('button',{name:/^Ver /})).toHaveLength(3);
  expect(screen.queryByText('MUESTRA')).not.toBeInTheDocument();
 });
 it('only mounts video after opening a catalog item and exposes accessible playback controls',async()=>{const {container}=render(<Catalog/>);expect(container.querySelector('video')).toBeNull();await userEvent.click(screen.getByRole('button',{name:`Ver ${portfolio[0].title}`}));expect(screen.getByRole('dialog')).toBeInTheDocument();const video=document.querySelector('video')!;expect(video).toHaveAttribute('src',portfolio[0].video);expect(video).toHaveAttribute('poster',portfolio[0].poster);expect(video).toHaveAttribute('aria-label',portfolio[0].title);expect(video).toHaveAttribute('controls');expect(video).toHaveAttribute('preload','metadata');expect(video).not.toHaveAttribute('autoplay');expect(video.muted).toBe(true);});
 it('marks portrait playback for the mobile immersive layout without changing horizontal playback',async()=>{render(<Catalog/>);const portraitTrigger=screen.getByRole('button',{name:`Ver ${portfolio[2].title}`});await userEvent.click(portraitTrigger);const portraitDialog=screen.getByRole('dialog');const portraitVideo=document.querySelector('video')!;expect(portraitDialog).toHaveClass('film-dialog-portrait');expect(portraitVideo).toHaveClass('catalog-video-portrait');expect(portraitVideo).toHaveAttribute('aria-label',portfolio[2].title);expect(portraitVideo).toHaveAttribute('controls');expect(portraitVideo).toHaveAttribute('playsinline');expect(portraitVideo).not.toHaveAttribute('autoplay');await userEvent.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());await waitFor(()=>expect(portraitTrigger).toHaveFocus());await userEvent.click(screen.getByRole('button',{name:`Ver ${portfolio[0].title}`}));expect(screen.getByRole('dialog')).not.toHaveClass('film-dialog-portrait');expect(document.querySelector('video')).not.toHaveClass('catalog-video-portrait');});
 it('closes on Escape, unmounts the player and restores focus',async()=>{render(<Catalog/>);const trigger=screen.getByRole('button',{name:`Ver ${portfolio[0].title}`});await userEvent.click(trigger);await userEvent.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());await waitFor(()=>expect(trigger).toHaveFocus());expect(document.querySelector('video')).toBeNull();});
 it('offers a useful poster fallback and retry action if a video fails',async()=>{render(<Catalog/>);await userEvent.click(screen.getByRole('button',{name:`Ver ${portfolio[0].title}`}));fireEvent.error(document.querySelector('video')!);expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar');expect(screen.getByRole('img',{name:'Vista previa del video'})).toHaveAttribute('src',portfolio[0].poster);expect(screen.getByRole('button',{name:'Reintentar'})).toBeInTheDocument();});
});
