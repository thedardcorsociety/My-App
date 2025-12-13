const knowledgeBase = [
    {
        inputs: ["halo", "hai", "selamat pagi", "selamat siang", "selamat malam", "p", "hi", "hello", "assalamualaikum", "test"],
        output: "Halo! Saya Dardcor AI. Saya siap membantu Anda membuat codingan, menjawab pertanyaan teknis, atau sekadar berdiskusi. Apa yang ingin Anda buat hari ini?"
    },
    {
        inputs: ["siapa namamu", "siapa kamu", "info bot", "perkenalkan dirimu", "kamu ai apa", "tentang kamu"],
        output: "Saya adalah Dardcor AI, asisten virtual cerdas yang dikembangkan untuk membantu programmer. Saya berjalan menggunakan engine TensorFlow.js."
    },
    {
        inputs: ["terima kasih", "thanks", "makasih", "thank you", "arigato", "thx"],
        output: "Sama-sama! Senang bisa membantu Anda. Jangan ragu untuk bertanya lagi jika butuh codingan lain."
    },
    {
        inputs: ["bisa apa saja", "fitur apa", "help", "bantuan", "menu", "apa yang bisa kamu lakukan"],
        output: "Saya bisa membuatkan contoh kode untuk berbagai bahasa pemrograman (HTML, CSS, JS, Python, PHP, SQL, dll), menjelaskan konsep coding, dan membantu debugging sederhana."
    },
    {
        inputs: ["kamu pintar", "hebat", "bagus", "keren", "good job", "mantap"],
        output: "Terima kasih! Saya terus belajar dari interaksi dengan Anda agar menjadi semakin pintar."
    },
    {
        inputs: ["bodoh", "stupid", "jelek", "kurang pintar", "salah", "error"],
        output: "Maaf jika jawaban saya belum memuaskan. Mohon berikan detail lebih spesifik agar saya bisa memperbaikinya."
    },
    {
        inputs: ["buatkan struktur html dasar", "codingan html biasa", "contoh file html", "boilerplate html", "html template", "kerangka html"],
        output: `Berikut adalah struktur dasar HTML5 yang standar:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Judul Halaman</title>
</head>
<body>
    <header>
        <h1>Selamat Datang</h1>
    </header>
    <main>
        <p>Konten halaman web Anda di sini.</p>
    </main>
    <footer>
        <p>&copy; 2024 Website Saya</p>
    </footer>
</body>
</html>
\`\`\``
    },
    {
        inputs: ["buatkan form login html", "codingan login page", "contoh formulir masuk", "bikin input login", "form sign in"],
        output: `Ini contoh form login yang rapi:

\`\`\`html
<div class="login-container">
    <form action="/api/login" method="POST">
        <h2>Login</h2>
        <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required placeholder="Masukkan email...">
        </div>
        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required placeholder="Masukkan password...">
        </div>
        <button type="submit">Masuk</button>
    </form>
</div>
\`\`\``
    },
    {
        inputs: ["buatkan tabel html", "codingan table", "contoh tabel data", "html table structure"],
        output: `Berikut kode untuk membuat tabel HTML dengan header dan body:

\`\`\`html
<table border="1">
    <thead>
        <tr>
            <th>No</th>
            <th>Nama</th>
            <th>Email</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>1</td>
            <td>Budi</td>
            <td>budi@example.com</td>
        </tr>
        <tr>
            <td>2</td>
            <td>Siti</td>
            <td>siti@example.com</td>
        </tr>
    </tbody>
</table>
\`\`\``
    },
    {
        inputs: ["buatkan navigasi bar", "codingan navbar", "contoh menu atas", "html css navbar"],
        output: `Ini contoh Navbar sederhana dengan HTML dan CSS:

\`\`\`html
<nav style="background: #333; padding: 1rem;">
    <a href="#" style="color: white; text-decoration: none; margin-right: 15px;">Home</a>
    <a href="#" style="color: white; text-decoration: none; margin-right: 15px;">About</a>
    <a href="#" style="color: white; text-decoration: none; margin-right: 15px;">Contact</a>
</nav>
\`\`\``
    },
    {
        inputs: ["masukkan gambar html", "codingan image", "img tag", "cara pasang foto di html"],
        output: `Gunakan tag <img> seperti ini:

\`\`\`html
<img src="gambar.jpg" alt="Deskripsi Gambar" width="300" height="200">
\`\`\``
    },
    {
        inputs: ["buatkan list html", "codingan daftar", "ul li html", "ordered list", "unordered list"],
        output: `Ini contoh List tidak berurutan (bullet) dan berurutan (angka):

\`\`\`html
<ul>
    <li>Item Satu</li>
    <li>Item Dua</li>
</ul>

<ol>
    <li>Langkah Pertama</li>
    <li>Langkah Kedua</li>
</ol>
\`\`\``
    },
    {
        inputs: ["cara menengahkan div css", "css center div", "codingan flexbox center", "buat posisi tengah css", "align center css"],
        output: `Gunakan Flexbox untuk menengahkan elemen dengan mudah:

\`\`\`css
.container {
    display: flex;
    justify-content: center; /* Tengah Horizontal */
    align-items: center;     /* Tengah Vertikal */
    height: 100vh;           /* Full Layar */
}
\`\`\``
    },
    {
        inputs: ["buatkan tombol menarik css", "codingan button keren", "css button hover", "style button"],
        output: `Ini style CSS untuk tombol modern dengan efek hover:

\`\`\`css
.btn-modern {
    background-color: #4CAF50;
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    transition: transform 0.2s, background-color 0.2s;
}

.btn-modern:hover {
    background-color: #45a049;
    transform: scale(1.05);
}
\`\`\``
    },
    {
        inputs: ["css grid layout", "contoh grid css", "membuat kolom css", "codingan grid"],
        output: `Contoh layout 3 kolom menggunakan CSS Grid:

\`\`\`css
.grid-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
}

.grid-item {
    background-color: #f0f0f0;
    padding: 20px;
    border: 1px solid #ddd;
}
\`\`\``
    },
    {
        inputs: ["buatkan card css", "codingan kartu produk", "css card design", "kotak profil css"],
        output: `Ini contoh desain Card sederhana:

\`\`\`css
.card {
    box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);
    transition: 0.3s;
    width: 300px;
    border-radius: 10px;
    padding: 16px;
    background: white;
}

.card:hover {
    box-shadow: 0 8px 16px 0 rgba(0,0,0,0.2);
}
\`\`\``
    },
    {
        inputs: ["css media query", "codingan responsive", "buat web mobile friendly", "css untuk hp"],
        output: `Gunakan Media Query agar web responsif di HP:

\`\`\`css
/* Style default untuk Desktop */
.container { width: 80%; }

/* Style untuk Layar HP (max 600px) */
@media only screen and (max-width: 600px) {
    .container {
        width: 100%;
        padding: 10px;
    }
}
\`\`\``
    },
    {
        inputs: ["buatkan fungsi penjumlahan javascript", "codingan js tambah", "function sum javascript", "hitung js"],
        output: `Fungsi penjumlahan sederhana di JavaScript:

\`\`\`javascript
function tambah(a, b) {
    return a + b;
}

console.log(tambah(10, 5)); // Output: 15
\`\`\``
    },
    {
        inputs: ["cara fetch api javascript", "codingan ambil data api", "js fetch example", "ajax modern"],
        output: `Cara mengambil data dari API menggunakan Fetch (Async/Await):

\`\`\`javascript
async function ambilData() {
    try {
        const response = await fetch('https://api.example.com/data');
        if (!response.ok) throw new Error('Gagal mengambil data');
        
        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error('Error:', error);
    }
}

ambilData();
\`\`\``
    },
    {
        inputs: ["event listener js", "codingan klik tombol", "javascript onclick", "handle click js"],
        output: `Cara mendeteksi klik tombol di JavaScript:

\`\`\`javascript
const tombol = document.getElementById('myButton');

tombol.addEventListener('click', function() {
    alert('Tombol diklik!');
    console.log('Action dijalankan');
});
\`\`\``
    },
    {
        inputs: ["looping javascript", "contoh for loop", "perulangan js", "array map js"],
        output: `Contoh looping menggunakan forEach pada Array:

\`\`\`javascript
const buah = ['Apel', 'Mangga', 'Jeruk'];

// Cara Modern
buah.forEach((item, index) => {
    console.log(\`Buah ke-\${index + 1}: \${item}\`);
});
\`\`\``
    },
    {
        inputs: ["dom manipulation js", "ubah text javascript", "ganti warna js", "document getelement"],
        output: `Cara mengubah teks dan warna elemen HTML via JS:

\`\`\`javascript
const judul = document.getElementById('judul-utama');

// Ubah Teks
judul.innerText = "Halo Dunia Baru!";

// Ubah Style
judul.style.color = "blue";
judul.style.fontSize = "24px";
\`\`\``
    },
    {
        inputs: ["local storage js", "simpan data browser", "javascript save data", "localstorage set item"],
        output: `Cara menyimpan dan mengambil data di LocalStorage browser:

\`\`\`javascript
// Simpan Data
localStorage.setItem('username', 'DardcorUser');

// Ambil Data
const user = localStorage.getItem('username');
console.log(user);

// Hapus Data
localStorage.removeItem('username');
\`\`\``
    },
    {
        inputs: ["node js server sederhana", "codingan express js", "buat server node", "basic express app"],
        output: `Ini boilerplate dasar server menggunakan Express.js:

\`\`\`javascript
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
    res.send('Hello World from Node.js!');
});

app.listen(port, () => {
    console.log(\`Server berjalan di http://localhost:\${port}\`);
});
\`\`\``
    },
    {
        inputs: ["baca file node js", "fs readfile", "codingan file system node", "buka file js"],
        output: `Cara membaca file teks menggunakan modul 'fs' di Node.js:

\`\`\`javascript
const fs = require('fs');

fs.readFile('data.txt', 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(data);
});
\`\`\``
    },
    {
        inputs: ["react component basic", "codingan react js", "komponen react", "functional component react"],
        output: `Contoh komponen React sederhana (Functional Component):

\`\`\`javascript
import React from 'react';

function Welcome(props) {
    return (
        <div className="container">
            <h1>Halo, {props.name}</h1>
            <p>Selamat datang di React!</p>
        </div>
    );
}

export default Welcome;
\`\`\``
    },
    {
        inputs: ["react usestate hook", "state di react", "codingan counter react", "react hooks contoh"],
        output: `Contoh penggunaan useState di React:

\`\`\`javascript
import React, { useState } from 'react';

function Counter() {
    const [count, setCount] = useState(0);

    return (
        <div>
            <p>Anda menekan {count} kali</p>
            <button onClick={() => setCount(count + 1)}>
                Tambah
            </button>
        </div>
    );
}
\`\`\``
    },
    {
        inputs: ["koneksi database php", "pdo php mysql", "codingan connect db", "php database connection"],
        output: `Koneksi database MySQL menggunakan PDO di PHP:

\`\`\`php
<?php
$host = 'localhost';
$db   = 'nama_database';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Koneksi Berhasil";
} catch(PDOException $e) {
    echo "Koneksi Gagal: " . $e->getMessage();
}
?>
\`\`\``
    },
    {
        inputs: ["tampilkan data php", "php fetch data", "looping data php", "mysql select php"],
        output: `Cara menampilkan data dari database di PHP:

\`\`\`php
<?php
$stmt = $pdo->query("SELECT * FROM users");
while ($row = $stmt->fetch()) {
    echo $row['nama'] . "<br>";
}
?>
\`\`\``
    },
    {
        inputs: ["python hello world", "dasar python", "codingan python simple", "print python"],
        output: `Program pertama Python:

\`\`\`python
print("Hello, World!")

# Variabel
nama = "Dardcor"
print(f"Halo, {nama}")
\`\`\``
    },
    {
        inputs: ["looping python", "for loop python", "perulangan python", "list python"],
        output: `Contoh looping list di Python:

\`\`\`python
buah = ["Apel", "Pisang", "Cerry"]

for item in buah:
    print(item)
\`\`\``
    },
    {
        inputs: ["python function", "fungsi python", "def python", "buat fungsi python"],
        output: `Membuat fungsi di Python:

\`\`\`python
def sapa(nama):
    return f"Halo {nama}, selamat pagi!"

pesan = sapa("Budi")
print(pesan)
\`\`\``
    },
    {
        inputs: ["sql select query", "codingan ambil data sql", "mysql select all", "query dasar sql"],
        output: `Query SQL untuk mengambil data:

\`\`\`sql
SELECT * FROM users WHERE active = 1 ORDER BY created_at DESC;
\`\`\``
    },
    {
        inputs: ["sql insert query", "tambah data sql", "mysql insert into", "simpan data sql"],
        output: `Query SQL untuk menyimpan data baru:

\`\`\`sql
INSERT INTO products (name, price, stock) 
VALUES ('Laptop Gaming', 15000000, 10);
\`\`\``
    },
    {
        inputs: ["sql update query", "edit data sql", "mysql update set", "ubah data sql"],
        output: `Query SQL untuk mengubah data:

\`\`\`sql
UPDATE users 
SET email = 'baru@email.com', status = 'active' 
WHERE id = 5;
\`\`\``
    },
    {
        inputs: ["sql delete query", "hapus data sql", "mysql delete from", "hilangkan data sql"],
        output: `Query SQL untuk menghapus data (Hati-hati!):

\`\`\`sql
DELETE FROM orders WHERE id = 105;
\`\`\``
    },
    {
        inputs: ["git basic commands", "perintah git dasar", "cara git push", "git commit tutorial"],
        output: `Daftar perintah Git yang sering dipakai:

\`\`\`bash
git init          # Mulai repo baru
git add .         # Pilih semua file
git commit -m "Pesan update"  # Simpan perubahan
git push origin main  # Upload ke server
git pull origin main  # Download update terbaru
\`\`\``
    },
    {
        inputs: ["algoritma fizzbuzz", "codingan fizzbuzz js", "logika fizzbuzz", "interview code fizzbuzz"],
        output: `Solusi FizzBuzz klasik di JavaScript:

\`\`\`javascript
for (let i = 1; i <= 100; i++) {
    if (i % 3 === 0 && i % 5 === 0) console.log("FizzBuzz");
    else if (i % 3 === 0) console.log("Fizz");
    else if (i % 5 === 0) console.log("Buzz");
    else console.log(i);
}
\`\`\``
    },
    {
        inputs: ["cek bilangan prima", "algoritma prima js", "codingan prime number", "logika bilangan prima"],
        output: `Fungsi cek bilangan prima di JS:

\`\`\`javascript
function isPrime(num) {
    if (num <= 1) return false;
    for (let i = 2; i <= Math.sqrt(num); i++) {
        if (num % i === 0) return false;
    }
    return true;
}

console.log(isPrime(17)); // true
\`\`\``
    },
    {
        inputs: ["tailwind css setup", "cdn tailwind", "codingan tailwind", "cara pakai tailwind"],
        output: `Cara cepat pakai Tailwind CSS via CDN:

\`\`\`html
<script src="https://cdn.tailwindcss.com"></script>

<div class="bg-blue-500 text-white p-4 rounded-lg shadow-lg">
    <h1 class="text-2xl font-bold">Halo Tailwind!</h1>
</div>
\`\`\``
    },
    {
        inputs: ["bootstrap starter", "cdn bootstrap", "codingan bootstrap dasar", "template bootstrap"],
        output: `Starter template Bootstrap 5:

\`\`\`html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

<div class="container mt-5">
    <div class="alert alert-primary" role="alert">
        Website Bootstrap Sederhana
    </div>
    <button class="btn btn-success">Klik Saya</button>
</div>
\`\`\``
    },
    {
        inputs: ["rest api express", "buat api node js", "codingan backend api", "route express json"],
        output: `Contoh REST API endpoint sederhana dengan Express:

\`\`\`javascript
app.get('/api/users', (req, res) => {
    const users = [
        { id: 1, name: 'Dardcor' },
        { id: 2, name: 'AI' }
    ];
    res.json({
        success: true,
        data: users
    });
});
\`\`\``
    },
    {
        inputs: ["promise javascript", "contoh promise", "asynchronous js", "codingan janji js"],
        output: `Contoh penggunaan Promise di JS:

\`\`\`javascript
const janji = new Promise((resolve, reject) => {
    const sukses = true;
    if (sukses) resolve("Berhasil!");
    else reject("Gagal.");
});

janji
    .then(res => console.log(res))
    .catch(err => console.log(err));
\`\`\``
    },
    {
        inputs: ["class javascript", "oop js", "codingan kelas objek", "object oriented js"],
        output: `Konsep Class (OOP) di JavaScript Modern:

\`\`\`javascript
class Mobil {
    constructor(merk) {
        this.merk = merk;
    }
    
    jalan() {
        return "Mobil " + this.merk + " sedang melaju.";
    }
}

const myCar = new Mobil("Toyota");
console.log(myCar.jalan());
\`\`\``
    },
    {
        inputs: ["python flask basic", "buat web python", "codingan flask", "server python sederhana"],
        output: `Aplikasi web sederhana menggunakan Flask (Python):

\`\`\`python
from flask import Flask

app = Flask(__name__)

@app.route("/")
def hello():
    return "Hello from Flask!"

if __name__ == "__main__":
    app.run(debug=True)
\`\`\``
    },
    {
        inputs: ["sql join query", "gabung tabel sql", "mysql inner join", "relasi tabel sql"],
        output: `Menggabungkan dua tabel menggunakan INNER JOIN:

\`\`\`sql
SELECT orders.id, users.name, orders.amount 
FROM orders 
INNER JOIN users ON orders.user_id = users.id;
\`\`\``
    },
    {
        inputs: ["css animation", "codingan animasi css", "keyframe css", "gerakkan elemen css"],
        output: `Membuat animasi sederhana dengan CSS Keyframes:

\`\`\`css
@keyframes geser {
    from { transform: translateX(0); }
    to { transform: translateX(100px); }
}

.box {
    width: 50px;
    height: 50px;
    background: red;
    animation: geser 2s infinite alternate;
}
\`\`\``
    }
];

module.exports = { knowledgeBase };