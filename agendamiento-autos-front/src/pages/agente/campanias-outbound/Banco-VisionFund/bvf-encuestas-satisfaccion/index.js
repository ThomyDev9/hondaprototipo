import formulario2 from "./formulario2.config";
import formulario3 from "./formulario3.config";

const bvfEncuestasSatisfaccion = {
    match: /BVF ENCUESTAS DE SATISFACCION|BVF ENCUESTAS DE SATISFACCIÓN/i,
    form2: formulario2,
    form3: formulario3,
};

export default bvfEncuestasSatisfaccion;
