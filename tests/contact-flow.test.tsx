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
		expect(screen.getByText('+52 993 129 6802')).toBeInTheDocument();
		expect(screen.getByRole('link',{name:'aele.studio21@gmail.com'})).toHaveAttribute('href','mailto:aele.studio21@gmail.com');
		expect(screen.getByRole('link',{name:/@aele\.dron/})).toHaveAttribute('href','https://www.instagram.com/aele.dron/');
	});
});
