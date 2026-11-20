# SportsHub — Eventi Sportivi

SportsHub è un'applicazione web responsive che permette di cercare squadre di vari sport (calcio, basket, football americano), visualizzarne i dati principali, consultare i prossimi eventi e gli ultimi risultati in tempo reale, e salvare le squadre preferite nel browser.

Progetto realizzato come **Week Project (Settimana VII)** per il corso di Web Development di Epicode.

---

## 🛠️ Tecnologie utilizzate

* **HTML5**: Struttura semantica della pagina.
* **CSS3 & Bootstrap 5**: Design responsive (mobile, tablet, desktop) e stili personalizzati.
* **JavaScript (ES6+)**: Logica dinamica, manipolazione del DOM sicura senza `innerHTML`, classi e gestione degli eventi.
* **TheSportsDB API**: REST API pubblica per il recupero dei dati di squadre ed eventi.
* **localStorage**: Persistenza dei dati delle squadre preferite anche al ricaricamento della pagina.

---

## 🚀 Funzionalità principali

### Versione Base
* **Ricerca squadre**: Form di ricerca per cercare qualsiasi squadra tramite l'endpoint `/searchteams.php`.
* **Rendering sicuro**: Creazione dinamica di card e contenuti tramite `document.createElement` e `textContent`.
* **Dettagli squadra**: Cliccando su una card si caricano in parallelo (`Promise.all`) i **Prossimi eventi** (`/eventsnext.php`) e gli **Ultimi risultati** (`/eventslast.php`).
* **Classi ES6**: Gestione dei dati tramite le classi `Squadra` ed `Evento`, con formattazione della data (`Intl.DateTimeFormat`) e calcolo del punteggio.
* **Gestione errori e caricamento**: Mostra uno spinner durante le chiamate API e avvisi in caso di errore o di nessun risultato trovato.

### Versione Intermedia
* **Squadre preferite**: Salvataggio e rimozione delle squadre preferite tramite `localStorage`.
* **Debounce**: La ricerca parte in automatico dopo 400ms di pausa nella digitazione.
* **AbortController**: Annullamento delle chiamate HTTP precedenti se ne parte una nuova durante la digitazione.
* **Layout Responsive**: Griglia da 1 colonna su mobile fino a 3-4 colonne su desktop.

### Versione Avanzata
* **Caricamento all'avvio (`Promise.allSettled`)**: Aggiornamento iniziale dei dettagli delle squadre preferite senza bloccare l'app in caso di errore su una singola squadra.
* **Filtro per sport**: Bottoni per filtrare le squadre trovate in base a `strSport` (Tutti, Calcio, Basket, Football).
* **Modale dettagli evento**: Cliccando su un singolo evento si apre una finestra modale di Bootstrap con i dettagli completi della partita.

---

## 📁 Struttura della cartella

```text
sportshub/
├── index.html
├── README.md
└── assets/
    ├── script/
    │   └── script.js
    └── style/
        └── style.css