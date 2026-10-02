export const site = {
  name: 'aele·dron',
  location: 'Villahermosa, Tabasco',
  instagram: 'https://www.instagram.com/aele.dron/',
  tiktok: 'https://www.tiktok.com/@aele.dron',
  socialHandle: '@aele.dron',
  email: 'aele.studio21@gmail.com',
  whatsappNumber: '+52 9931296802',
};
export type PortfolioItem = {
  id: string; title: string; category: string; description: string;
  poster: string; video: string; aspect: 'wide' | 'portrait';
};
export const portfolio: PortfolioItem[] = [
  {id:'jac-veracruz',title:'JAC Veracruz',category:'JAC VERACRUZ',description:'Una pieza audiovisual de JAC Veracruz.',poster:'/media/jac-veracruz-poster.jpg',video:'/media/jac-veracruz.mp4',aspect:'wide'},
  {id:'hyper-vsa',title:'Hyper Vsa',category:'HYPER VSA',description:'Una pieza audiovisual de Hyper Vsa.',poster:'/media/hyper-vsa-poster.jpg',video:'/media/hyper-vsa.mp4',aspect:'wide'},
  {id:'day-to-night',title:'Day to night',category:'DAY TO NIGHT',description:'Una transición visual del día a la noche.',poster:'/media/day-to-night-poster.jpg',video:'/media/day-to-night.mp4',aspect:'portrait'},
];
export const eventTypes = ['Boda','XV años','Concierto o festival','Evento deportivo','Evento corporativo','Otro evento'] as const;
