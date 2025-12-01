// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                login: resolve(__dirname, 'login.html'),
                student: resolve(__dirname, 'student.html'),
                student1: resolve(__dirname, 'student1.html'),
                student2: resolve(__dirname, 'student2.html'),
                idea: resolve(__dirname, 'idea.html'),
                reflection: resolve(__dirname, 'reflection.html'),
                teacher: resolve(__dirname, 'teacher.html'),
            },
        },
    },
    optimizeDeps: {
        exclude: ['pdfjs-dist'],
    },
});
