import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe,it,expect } from 'vitest';
import { Catalog } from '../components/catalog';
import { portfolio } from '../lib/site-content';
describe('catalog player',()=>{
 it('only mounts video after opening a sample',async()=>{const {container}=render(<Catalog/>);expect(container.querySelector('video')).toBeNull();await userEvent.click(screen.getByRole('button',{name:`Ver ${portfolio[0].title}`}));expect(screen.getByRole('dialog')).toBeInTheDocument();const video=document.querySelector('video')!;expect(video).not.toHaveAttribute('autoplay');expect(video.muted).toBe(true);});
 it('closes on Escape, unmounts the player and restores focus',async()=>{render(<Catalog/>);const trigger=screen.getByRole('button',{name:`Ver ${portfolio[0].title}`});await userEvent.click(trigger);await userEvent.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());await waitFor(()=>expect(trigger).toHaveFocus());expect(document.querySelector('video')).toBeNull();});
 it('offers a useful failure state instead of a broken video',async()=>{render(<Catalog/>);await userEvent.click(screen.getByRole('button',{name:`Ver ${portfolio[0].title}`}));fireEvent.error(document.querySelector('video')!);expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar');expect(screen.getByRole('button',{name:'Reintentar'})).toBeInTheDocument();});
});
