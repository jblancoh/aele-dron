export const site = {
  name: 'aele·dron',
  location: 'Villahermosa, Tabasco',
  instagram: 'https://www.instagram.com/aele.dron/',
  // Set the company's real international number before commercial launch.
  whatsappNumber: '',
};
export type PortfolioItem = {
  id: string; title: string; category: string; description: string;
  poster: string; video: string; aspect: 'wide' | 'portrait';
  demo: boolean; source: string; license: string;
};
export const portfolio: PortfolioItem[] = [
  {id:'concert',title:'La energía de estar ahí',category:'CONCIERTOS Y FESTIVALES',description:'Luces, música y miles de emociones en un mismo lugar.',poster:'/media/concert-poster.jpg',video:'/media/concert.mp4',aspect:'wide',demo:true,source:'https://mixkit.co/free-stock-video/audience-at-a-concert-4269/',license:'https://mixkit.co/license/#videoFree'},
  {id:'wedding',title:'Un sí. Todo un mundo.',category:'BODAS Y CELEBRACIONES',description:'Esos instantes que se quedan contigo para siempre.',poster:'/media/wedding-poster.jpg',video:'/media/wedding.mp4',aspect:'portrait',demo:true,source:'https://mixkit.co/free-stock-video/happy-newlyweds-posing-40601/',license:'https://mixkit.co/license/#videoFree'},
  {id:'coast',title:'El escenario también cuenta',category:'ESPACIOS Y PERSPECTIVAS',description:'Una nueva forma de descubrir el lugar donde todo sucede.',poster:'/media/coast-poster.jpg',video:'/media/coast.mp4',aspect:'wide',demo:true,source:'https://mixkit.co/free-stock-video/flying-over-a-beautiful-tropical-landscape-5369/',license:'https://mixkit.co/license/#videoFree'},
];
export const eventTypes = ['Boda','XV años','Concierto o festival','Evento deportivo','Evento corporativo','Otro evento'] as const;
