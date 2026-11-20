export const REQUISITOS_DE_TRABAJO = [
  "I. Todos los trabajos a realizarse deberán contar con el 50% de anticipo, de lo contrario no se dará fecha de recibido.",
  "II. La orden de trabajo debe incluir detalladamente las características del trabajo: color, material a utilizar, enviar fotografía. En caso de que el trabajo se detenga por la falta de datos se adicionarán los días perdidos por la situación.",
  "III. El trabajo debe liquidarse al momento de su entrega. No después.",
  "IV. Para la elaboración de su trabajo es necesario un tiempo razonable contando únicamente días hábiles. 10 Días hábiles.",
  "V. Para poder otorgar una fecha de entrega, es necesario revisar que las impresiones y/o modelos de trabajo estén en buen estado.",
  "VI. Los modelos de trabajo deberán de ser arcada completa, sin importar que sean restauraciones pequeñas como incrustaciones o coronas individuales.",
  "VII. Trabajos completamente libres de metal y aquellos donde se haya indicado la elaboración de modelos Geller, es indispensable enviar la cucharilla de trabajo, de caso contrario no se podrá comenzar la elaboración del trabajo.",
  "VIII. TODOS LOS AGREGADOS QUE SEAN POSTERIORES Y QUE NO SEAN POR CULPA DE LABORATORIO, ES DECIR POR FALTA DE FOTOS, COLOR DE SUSTRATO O COLOR FINAL ESPECÍFICO TENDRÁN UN COSTO EXTRA DE $200.00 POR UNIDAD, Y EL ENVÍO CORRERÁ POR SU CUENTA.",
  "IX. Requisitos para sector anterior: modelo antagonista, impresión final, registro de mordida, prototipo (mockup), fotos, color de sustrato y color final.",
] as const;

export const GARANTIA = [
  "I. Pierden la garantía aquellos trabajos que por falta de una correcta manipulación en el consultorio sufren fracturas o en su defecto la pérdida total de la restauración.",
  "II. No se extiende garantía sobre trabajos que estando bien ajustados sobre el modelo de trabajo, no ajusten correctamente en boca, ya que eso se debe a distorsiones sobre el modelo de trabajo.",
] as const;

export const COMUNICACION = [
  "I. En caso de alguna inconformidad con los servicios que el laboratorio le otorga, le recomendamos que pueda comunicarse directamente con el personal a cargo del laboratorio para resolver cualquier problema con su caso.",
  "II. De la manera más atenta, se le solicita respeto al momento de dirigirse hacia los trabajadores del laboratorio, ya que no se tolerarán conductas inadecuadas del doctor hacia el laboratorio y viceversa.",
] as const;

export const POLITICAS_INTERNAS = [
  "I. NO SE ALMACENARÁN ARCHIVOS STL's DESPUÉS DE 3 MESES DE QUE SE HAYA ENTREGADO O ENVIADO EL TRABAJO, SE RECOMIENDA TENER EL RESPALDO DE SUS ARCHIVOS.",
  "II. CASO TERMINADO QUE PERMANEZCA MÁS DE 3 MESES EN EL LABORATORIO Y NO ESTÉ PAGADO SERÁ DESECHADO, SI POSTERIORMENTE REQUIERE EL TRABAJO TENDRÁ QUE CUBRIR EL COSTO TOTAL.",
  "III. PARA TODO CASO QUE REINGRESE SE REQUIERE NUEVA IMPRESIÓN O NUEVO ESCANEO, PARA VERIFICAR QUE NO SE HAYA REPREPARADO Y PODER HACER VÁLIDA LA GARANTÍA.",
] as const;

export const POLITICAS_SERVICIO_MARKDOWN = [
  "# SERVICIOS A CLIENTES",
  "",
  "## REQUISITOS DE TRABAJO",
  ...REQUISITOS_DE_TRABAJO.map((p) => `- ${p}`),
  "",
  "## GARANTÍA",
  ...GARANTIA.map((p) => `- ${p}`),
  "",
  "## COMUNICACIÓN",
  ...COMUNICACION.map((p) => `- ${p}`),
  "",
  "## POLÍTICAS INTERNAS",
  ...POLITICAS_INTERNAS.map((p) => `- ${p}`),
].join("\n");
