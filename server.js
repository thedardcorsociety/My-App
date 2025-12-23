require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https://ui-avatars.com"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: null,
        },
    },
    crossOriginEmbedderPolicy: false
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));

const sessionDuration = 100 * 365 * 24 * 60 * 60 * 1000;

app.use(session({
    name: 'dardcor_session_id',
    secret: process.env.SESSION_SECRET || 'dardcor_permanent_secret_key',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { 
        secure: isProduction, 
        sameSite: 'lax', 
        maxAge: sessionDuration,
        path: '/',
        httpOnly: true
    }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'image')));

const dardcorRoutes = require('./routes/dardcorRoutes');
app.use('/', dardcorRoutes);

app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Halaman Tidak Ditemukan' });
});

const server = app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});

server.keepAliveTimeout = 600000;
server.headersTimeout = 610000;
server.timeout = 600000;