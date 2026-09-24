/**
 * Los datos del DEMO DEL ÁLBUM: la fiesta de quince de Camila, con las
 * fotos que «subieron» los invitados escaneando el QR de la mesa. Todo
 * ficticio; las fotos son de Unsplash (licencia gratuita, ids
 * verificados a ojo en la hoja de contacto del 21 sep 2026).
 */
const foto = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export type FotoAlbum = {
  id: string;
  url: string;
  autor: string;
  momento: "ceremonia" | "recepcion" | "fiesta" | "detalles";
  pie: string;
  likes: number;
  /** Proporción para el mosaico: alta (retrato) o ancha. */
  alta: boolean;
};

export const ALBUM_DEMO = {
  celebracion: "Camila Fernanda · XV años",
  fecha: "Sábado 8 de mayo de 2027",
  lugar: "Salón Real, Cartago",
  portada: foto("1595777457583-95e059d581b8", 1600),
  invitados: 42,
  fotos: [
    { id: "a1", url: foto("1595777457583-95e059d581b8"), autor: "Familia Fernández", momento: "ceremonia", pie: "La entrada de Camila", likes: 48, alta: true },
    { id: "a2", url: foto("1519741497674-611481863552"), autor: "Tía Rosa", momento: "detalles", pie: "El ramo", likes: 21, alta: false },
    { id: "a3", url: foto("1522413452208-996ff3f3e740"), autor: "Andrea M.", momento: "recepcion", pie: "La mesa principal", likes: 17, alta: false },
    { id: "a4", url: foto("1511795409834-ef04bbd61622"), autor: "Andrea M.", momento: "detalles", pie: "Centros de mesa", likes: 12, alta: true },
    { id: "a5", url: foto("1496337589254-7e19d01cec44"), autor: "Los primos", momento: "fiesta", pie: "¡A bailar!", likes: 63, alta: false },
    { id: "a6", url: foto("1492684223066-81342ee5ff30"), autor: "DJ Pablo", momento: "fiesta", pie: "Lluvia de confeti", likes: 55, alta: true },
    { id: "a7", url: foto("1519671482749-fd09be7ccebf"), autor: "Las amigas", momento: "recepcion", pie: "El brindis", likes: 34, alta: false },
    { id: "a8", url: foto("1529333166437-7750a6dd5a70"), autor: "Sofía R.", momento: "fiesta", pie: "Hasta el amanecer", likes: 29, alta: true },
    { id: "a9", url: foto("1527529482837-4698179dc6ce"), autor: "Abuela Marta", momento: "recepcion", pie: "La cena", likes: 15, alta: false },
    { id: "a10", url: foto("1518199266791-5375a83190b7"), autor: "Familia Fernández", momento: "detalles", pie: "Corazones de luz", likes: 40, alta: true },
    { id: "a11", url: foto("1530023367847-a683933f4172"), autor: "Tío Jorge", momento: "recepcion", pie: "La mesa larga", likes: 26, alta: false },
    { id: "a12", url: foto("1470229722913-7c0e2dbbafd3"), autor: "Los primos", momento: "fiesta", pie: "Luces", likes: 31, alta: true },
    { id: "a13", url: foto("1523438885200-e635ba2c371e"), autor: "Andrea M.", momento: "ceremonia", pie: "La iglesia", likes: 19, alta: false },
    { id: "a14", url: foto("1478147427282-58a87a120781"), autor: "Sofía R.", momento: "fiesta", pie: "Manos arriba", likes: 22, alta: true },
  ] satisfies FotoAlbum[],
};

export const MOMENTOS_ALBUM = [
  ["todas", "Todas"],
  ["ceremonia", "Ceremonia"],
  ["recepcion", "Recepción"],
  ["fiesta", "Fiesta"],
  ["detalles", "Detalles"],
] as const;
