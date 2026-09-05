import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe,it,expect} from 'vitest';
import { Contact } from '../components/contact';
describe('guided contact',()=>{
 it('validates each step and shows an honest unconfigured state',async()=>{render(<Contact/>);await userEvent.click(screen.getByRole('button',{name:/Continuar/}));expect(screen.getByRole('alert')).toHaveTextContent('Selecciona');await userEvent.click(screen.getByRole('radio',{name:'Boda'}));await userEvent.click(screen.getByRole('button',{name:/Continuar/}));await userEvent.click(screen.getByRole('checkbox',{name:'Por definir'}));await userEvent.type(screen.getByLabelText('Lugar del evento'),'Villahermosa');await userEvent.click(screen.getByRole('button',{name:/Revisar/}));expect(screen.getByText('WhatsApp pendiente de configurar')).toBeInTheDocument();expect(screen.queryByRole('link',{name:/Abrir WhatsApp/})).not.toBeInTheDocument();});
});
