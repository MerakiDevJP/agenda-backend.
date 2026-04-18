import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db';

// 1. Configuración de variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 2. Middlewares
app.use(cors({
    // URL que te da Render para el Frontend
    origin: 'https://agenda-frontend-c7hn.onrender.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Tip adicional: Agrega una ruta raíz para verificar que el servidor vive
app.get('/', (req, res) => {
    res.send('Servidor de Óptica Joesva (Backend) funcionando en Render');
});

// --- RUTAS DE PACIENTES ---

// Leer todos los pacientes
app.get('/api/pacientes', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM pacientes ORDER BY nombre ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener pacientes' });
    }
});

// Crear paciente con validaciones de Ecuador
app.post('/api/pacientes', async (req, res) => {
    const { nombre, cedula, telefono, direccion, mail, motivoConsulta } = req.body;

    if (!esCedulaValida(cedula)) {
        return res.status(400).json({
            error: 'Cédula inválida',
            message: 'El número no cumple con el algoritmo de verificación.'
        });
    }

    if (!soloLetras(nombre)) {
        return res.status(400).json({
            error: 'Nombre inválido',
            message: 'El nombre debe contener solo letras y espacios.'
        });
    }

    try {
        const [result]: any = await pool.query(
            'INSERT INTO pacientes (nombre, cedula, telefono, direccion, mail, motivoConsulta) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, cedula, telefono, direccion, mail, motivoConsulta]
        );
        res.status(201).json({ id: result.insertId, message: 'Paciente registrado con éxito' });
    } catch (error) {
        res.status(500).json({ error: 'Error en la base de datos', message: 'Posible cédula duplicada.' });
    }
});

// Editar paciente
app.put('/api/pacientes/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, cedula, telefono, direccion, mail, motivoConsulta } = req.body;

    try {
        await pool.query(
            'UPDATE pacientes SET nombre=?, cedula=?, telefono=?, direccion=?, mail=?, motivoConsulta=? WHERE id=?',
            [nombre, cedula, telefono, direccion, mail, motivoConsulta, id]
        );
        res.json({ message: 'Paciente actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar paciente' });
    }
});

// Eliminar paciente
app.delete('/api/pacientes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM pacientes WHERE id = ?', [id]);
        res.json({ message: 'Paciente eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'No se puede eliminar: el paciente tiene citas activas' });
    }
});

// --- RUTAS DE CITAS ---

// Obtener citas (con filtro opcional por fecha y optómetra)
app.get('/api/citas', async (req, res) => {
    const { fecha, optometra } = req.query;
    try {
        let query = 'SELECT * FROM citas';
        const params = [];
        if (fecha && optometra) {
            query += ' WHERE fecha = ? AND optometra = ?';
            params.push(fecha, optometra);
        }
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener citas' });
    }
});

// Crear una cita (Persistencia real)
app.post('/api/citas', async (req, res) => {
    const { id, pacienteId, fecha, hora, estado, optometra } = req.body;
    try {
        await pool.query(
            'INSERT INTO citas (id, pacienteId, fecha, hora, estado, optometra) VALUES (?, ?, ?, ?, ?, ?)',
            [id, pacienteId, fecha, hora, estado, optometra]
        );
        res.status(201).json({ message: 'Cita agendada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al agendar la cita' });
    }
});

// Actualizar una cita
app.put('/api/citas/:id', async (req, res) => {
    const { id } = req.params;
    const { pacienteId, fecha, hora, estado, optometra } = req.body;
    try {
        await pool.query(
            'UPDATE citas SET pacienteId=?, fecha=?, hora=?, estado=?, optometra=? WHERE id=?',
            [pacienteId, fecha, hora, estado, optometra, id]
        );
        res.json({ message: 'Cita modificada con éxito' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la cita' });
    }
});

// Eliminar/Cancelar cita
app.delete('/api/citas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM citas WHERE id = ?', [id]);
        res.json({ message: 'Cita cancelada y eliminada' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la cita' });
    }
});

// Ping de salud
app.get('/api/ping', (req, res) => {
    res.json({ message: '¡API de Óptica Joesva funcionando correctamente!' });
});

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(` Servidor corriendo en http://localhost:${PORT}`);
});

// --- FUNCIONES DE VALIDACIÓN ---

function esCedulaValida(cedula: string): boolean {
    if (!cedula || cedula.length !== 10) return false;
    const provincia = parseInt(cedula.substring(0, 2), 10);
    if (provincia < 1 || provincia > 24) return false;
    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;
    for (let i = 0; i < coeficientes.length; i++) {
        let valor = parseInt(cedula.substring(i, i + 1), 10) * coeficientes[i];
        suma += valor > 9 ? valor - 9 : valor;
    }
    const residuo = suma % 10;
    const verificador = residuo === 0 ? 0 : 10 - residuo;
    return verificador === parseInt(cedula.substring(9, 10), 10);
}

function soloLetras(texto: string): boolean {
    const regex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    return regex.test(texto);
}