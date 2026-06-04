# Dashboard ACCA - Gestión e Inscripciones de Alumnos

Un dashboard web interactivo y visual para explorar y analizar las inscripciones de alumnos en cursos de ACCA. El dashboard está configurado con un filtro estricto para mostrar únicamente registros a partir del **6 de Junio de 2026 inclusive** (ignorando los datos anteriores).

## Características principales

1. **Dashboard General**: 
   - Resumen clave con KPIs (Total alumnos, cursos únicos, profesores activos y niveles).
   - Gráfico de **Alumnos por Curso** (gráfico de barra horizontal ideal para visualizar códigos largos).
   - Distribución de alumnos por **Nivel** (gráfico de dona interactivo).
   - Inscripciones por **Profesor y Fecha** (gráfico de tendencias temporales interactivo con filtrado individual por docente).
2. **Constructor Pivot (Drag & Drop)**:
   - Panel interactivo para arrastrar variables (Código, Nivel, Profesor, Modalidad, etc.) y cruzarlas dinámicamente.
   - Generación de gráficos (Barras, Líneas, Tortas) e informes tabulares pivote con exportación instantánea a CSV.
3. **Explorador de Datos**:
   - Tabla paginada de todos los registros que cumplen el filtro de fecha.
   - Buscador rápido en todas las columnas y filtros combinados por Nivel y Profesor.
   - Botón para exportar los registros resultantes a un archivo CSV.
4. **Resiliencia ante CORS**:
   - Intenta cargar el archivo `Alumnos-Acca.csv` automáticamente al abrirse.
   - En caso de cargarse directamente sin servidor (usando `file://` en el navegador), provee una interfaz para arrastrar o cargar el archivo localmente con total seguridad.

---

## Cómo Ejecutar el Proyecto

Para garantizar que el navegador cargue el archivo de datos local automáticamente sin bloqueos de seguridad de CORS, se incluye un servidor de desarrollo local ligero.

### Requisitos previos
- Tener instalado [Node.js](https://nodejs.org/).

### Pasos para iniciar

1. **Instalar dependencias** (si no se realizó antes):
   ```bash
   npm install
   ```

2. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```

3. **Ver en el navegador**:
   Abre la dirección local que imprima la consola (generalmente `http://localhost:5173`). El sistema cargará el archivo `Alumnos-Acca.csv` automáticamente.

*(Nota: También puedes abrir el archivo `index.html` haciendo doble clic directamente, en cuyo caso la aplicación te pedirá que arrastres o selecciones el archivo `Alumnos-Acca.csv` desde tu explorador de archivos para cargarlo).*
