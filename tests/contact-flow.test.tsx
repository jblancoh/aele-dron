import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe,it,expect} from 'vitest';
import { Contact } from '../components/contact';
describe('guided contact',()=>{
	it('keeps the guided inquiry and opens the prepared WhatsApp message with the supplied contact details',async()=>{
		render(<Contact/>);
		await userEvent.click(screen.getByRole('button',{name:/Continuar/}));
		expect(screen.getByRole('alert')).toHaveTextContent('Selecciona');
		await userEvent.click(screen.getByRole('radio',{name:'Boda'}));
		await userEvent.click(screen.getByRole('button',{name:/Continuar/}));
		await userEvent.click(screen.getByRole('checkbox',{name:'Por definir'}));
		await userEvent.type(screen.getByLabelText('Lugar del evento'),'Villahermosa');
		await userEvent.click(screen.getByRole('button',{name:/Revisar/}));
		const whatsapp=screen.getByRole('link',{name:/Abrir WhatsApp/});
		expect(whatsapp).toHaveAttribute('href',expect.stringContaining('https://wa.me/529931296802?text='));
		expect(new URL(whatsapp.getAttribute('href')!).searchParams.get('text')).toContain('Evento: Boda');
		expect(screen.queryByText(/993\s?129\s?6802/)).not.toBeInTheDocument();
		expect(screen.queryByRole('link',{name:'aele.studio21@gmail.com'})).not.toBeInTheDocument();
		expect(screen.queryByRole('link',{name:/mailto:/})).not.toBeInTheDocument();
		expect(screen.getByRole('link',{name:/Instagram @aele\.dron/})).toHaveAttribute('href','https://www.instagram.com/aele.dron/');
		expect(screen.getByRole('link',{name:/TikTok @aele\.dron/})).toHaveAttribute('href','https://www.tiktok.com/@aele.dron');
	});
});
