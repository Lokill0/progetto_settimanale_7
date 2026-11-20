/* Endpoint base e chiave gratuita TheSportsDB */
const API_BASE = "https://www.thesportsdb.com/api/v1/json/123";
const STORAGE_KEY = "sportshub_preferiti";

/* Classe Squadra per mappare i dati dell'API */
class Squadra {
    constructor(data) {
        this.idTeam = data.idTeam;
        this.strTeam = data.strTeam;
        this.strBadge = data.strBadge || "";
        this.strLeague = data.strLeague || "Lega non disponibile";
        this.strCountry = data.strCountry || "Paese non disponibile";
        this.strSport = data.strSport || "Altro";
    }
}

/* Classe Evento per mappare i dati e formattare data e punteggio */
class Evento {
    constructor(data) {
        this.idEvent = data.idEvent;
        this.dateEvent = data.dateEvent || "";
        this.strTime = data.strTime || "";
        this.strEvent = data.strEvent || "";
        this.strLeague = data.strLeague || "";
        this.strHomeTeam = data.strHomeTeam || "Casa";
        this.strAwayTeam = data.strAwayTeam || "Trasferta";
        this.intHomeScore = data.intHomeScore;
        this.intAwayScore = data.intAwayScore;
    }

    formattaData() {
        if (!this.dateEvent) return "Data da definire";
        const dataObj = new Date(this.dateEvent);
        if (Number.isNaN(dataObj.getTime())) return this.dateEvent;
        return new Intl.DateTimeFormat("it-IT").format(dataObj);
    }

    getPunteggio() {
        if (this.intHomeScore === null || this.intHomeScore === undefined || this.intHomeScore === "") {
            return "";
        }
        const away = (this.intAwayScore === null || this.intAwayScore === undefined || this.intAwayScore === "")
            ? "-"
            : this.intAwayScore;
        return `${this.intHomeScore} - ${away}`;
    }
}

/* Stato dell'applicazione */
let squadreTrovate = [];
let sportSelezionato = "ALL";
let preferiti = [];
let controllerRicerca = null;
let debounceTimer = null;

/* Riferimenti agli elementi del DOM */
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const feedbackArea = document.getElementById("feedback-area");
const sportFilters = document.getElementById("sport-filters");
const preferitiList = document.getElementById("preferiti-list");
const risultatiList = document.getElementById("risultati-list");
const dettagliSection = document.getElementById("dettagli-section");
const dettagliTitolo = document.getElementById("dettagli-titolo");
const prossimiEventiList = document.getElementById("prossimi-eventi-list");
const ultimiEventiList = document.getElementById("ultimi-eventi-list");
const eventoModal = new bootstrap.Modal(document.getElementById("eventoModal"));
const modalEventoTitolo = document.getElementById("modal-evento-titolo");
const modalEventoCorpo = document.getElementById("modal-evento-corpo");

/* Funzione di utilità per mostrare spinner o alert */
function mostraFeedback(tipo, testo) {
    feedbackArea.textContent = "";
    if (!tipo) return;

    if (tipo === "loading") {
        const wrapper = document.createElement("div");
        wrapper.className = "d-flex align-items-center gap-2 text-secondary";

        const spinner = document.createElement("div");
        spinner.className = "spinner-border spinner-border-sm";
        spinner.setAttribute("role", "status");

        const msg = document.createElement("span");
        msg.textContent = testo;

        wrapper.appendChild(spinner);
        wrapper.appendChild(msg);
        feedbackArea.appendChild(wrapper);
        return;
    }

    const alertBox = document.createElement("div");
    alertBox.className = tipo === "error" ? "alert alert-danger" : "alert alert-info";
    alertBox.textContent = testo;
    feedbackArea.appendChild(alertBox);
}

/* Lettura e salvataggio preferiti in localStorage */
function leggiPreferitiStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(item => new Squadra(item)) : [];
    } catch (err) {
        return [];
    }
}

function salvaPreferitiStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferiti));
}

function isSquadraPreferita(idTeam) {
    return preferiti.some(sq => sq.idTeam === idTeam);
}

/* Aggiunta o rimozione squadra dai preferiti */
function togglePreferita(squadra) {
    const esiste = isSquadraPreferita(squadra.idTeam);
    if (esiste) {
        preferiti = preferiti.filter(sq => sq.idTeam !== squadra.idTeam);
    } else {
        preferiti.push(squadra);
    }
    salvaPreferitiStorage();
    renderPreferiti();
    renderSquadreTrovate();
}

/* Chiamata API per cercare le squadre con AbortController */
async function cercaSquadre(query) {
    const pulita = query.trim();
    if (!pulita) {
        squadreTrovate = [];
        renderSquadreTrovate();
        mostraFeedback(null);
        return;
    }

    if (controllerRicerca) {
        controllerRicerca.abort();
    }
    controllerRicerca = new AbortController();

    mostraFeedback("loading", "Ricerca squadre in corso...");

    try {
        const url = new URL(`${API_BASE}/searchteams.php`);
        url.searchParams.set("t", pulita);

        const res = await fetch(url.toString(), { signal: controllerRicerca.signal });
        if (!res.ok) {
            throw new Error("Errore nella risposta del server");
        }

        const data = await res.json();
        mostraFeedback(null);

        if (!data.teams) {
            squadreTrovate = [];
            renderSquadreTrovate();
            mostraFeedback("info", "Nessuna squadra trovata.");
            return;
        }

        squadreTrovate = data.teams.map(item => new Squadra(item));
        renderSquadreTrovate();
    } catch (err) {
        if (err.name === "AbortError") return;
        mostraFeedback("error", "Si è verificato un errore durante la ricerca delle squadre.");
    }
}

/* Chiamata in parallelo per prossimi eventi e ultimi risultati */
async function caricaDettagli(squadra) {
    dettagliSection.classList.remove("d-none");
    dettagliTitolo.textContent = squadra.strTeam;
    prossimiEventiList.textContent = "Caricamento...";
    ultimiEventiList.textContent = "Caricamento...";

    try {
        const urlNext = new URL(`${API_BASE}/eventsnext.php`);
        urlNext.searchParams.set("id", squadra.idTeam);

        const urlLast = new URL(`${API_BASE}/eventslast.php`);
        urlLast.searchParams.set("id", squadra.idTeam);

        const [resNext, resLast] = await Promise.all([
            fetch(urlNext.toString()),
            fetch(urlLast.toString())
        ]);

        if (!resNext.ok || !resLast.ok) {
            throw new Error("Errore nel caricamento degli eventi");
        }

        const dataNext = await resNext.json();
        const dataLast = await resLast.json();

        const prossimi = (dataNext.events || [])
            .map(ev => new Evento(ev))
            .sort((a, b) => new Date(a.dateEvent) - new Date(b.dateEvent));

        const ultimi = (dataLast.results || [])
            .map(ev => new Evento(ev))
            .sort((a, b) => new Date(b.dateEvent) - new Date(a.dateEvent));

        renderListaEventi(prossimiEventiList, prossimi, "Nessun evento in programma", false);
        renderListaEventi(ultimiEventiList, ultimi, "Nessun risultato disponibile", true);
    } catch (err) {
        prossimiEventiList.textContent = "Errore nel recupero dei prossimi eventi.";
        ultimiEventiList.textContent = "Errore nel recupero degli ultimi risultati.";
    }
}

/* Caricamento parallelo all'avvio delle squadre preferite con Promise.allSettled */
async function caricaPreferiteAllAvvio() {
    preferiti = leggiPreferitiStorage();
    renderPreferiti();

    if (preferiti.length === 0) return;

    const richieste = preferiti.map(sq => {
        const url = new URL(`${API_BASE}/searchteams.php`);
        url.searchParams.set("t", sq.strTeam);
        return fetch(url.toString()).then(r => r.json());
    });

    const risultati = await Promise.allSettled(richieste);
    risultati.forEach((esito, index) => {
        if (esito.status === "fulfilled" && esito.value && Array.isArray(esito.value.teams)) {
            const trovata = esito.value.teams.find(t => t.idTeam === preferiti[index].idTeam);
            if (trovata) {
                preferiti[index] = new Squadra(trovata);
            }
        }
    });

    salvaPreferitiStorage();
    renderPreferiti();
}

/* Apertura modale con i dettagli completi dell'evento */
function apriModaleEvento(evento) {
    modalEventoTitolo.textContent = evento.strEvent || `${evento.strHomeTeam} vs ${evento.strAwayTeam}`;
    modalEventoCorpo.textContent = "";

    const rigaData = document.createElement("p");
    rigaData.className = "mb-2";
    rigaData.textContent = `Data: ${evento.formattaData()}`;

    const rigaSquadre = document.createElement("p");
    rigaSquadre.className = "mb-2";
    rigaSquadre.textContent = `Partita: ${evento.strHomeTeam} vs ${evento.strAwayTeam}`;

    const punteggio = evento.getPunteggio();
    const rigaRisultato = document.createElement("p");
    rigaRisultato.className = "mb-2";
    rigaRisultato.textContent = punteggio ? `Risultato: ${punteggio}` : "Risultato: Non ancora disponibile";

    const rigaLega = document.createElement("p");
    rigaLega.className = "mb-0 text-secondary small";
    rigaLega.textContent = evento.strLeague ? `Competizione: ${evento.strLeague}` : "";

    modalEventoCorpo.appendChild(rigaData);
    modalEventoCorpo.appendChild(rigaSquadre);
    modalEventoCorpo.appendChild(rigaRisultato);
    if (evento.strLeague) {
        modalEventoCorpo.appendChild(rigaLega);
    }

    eventoModal.show();
}

/* Render di una lista di eventi (prossimi o ultimi) */
function renderListaEventi(contenitore, eventi, messaggioVuoto, mostraBadgeRisultato) {
    contenitore.textContent = "";

    if (!eventi || eventi.length === 0) {
        const emptyMsg = document.createElement("p");
        emptyMsg.className = "fst-italic text-secondary mb-0";
        emptyMsg.textContent = messaggioVuoto;
        contenitore.appendChild(emptyMsg);
        return;
    }

    eventi.forEach(ev => {
        const riga = document.createElement("div");
        riga.className = "evento-item d-flex justify-content-between align-items-center gap-2";

        const testoBox = document.createElement("div");

        const dataEl = document.createElement("div");
        dataEl.className = "small text-secondary";
        dataEl.textContent = ev.formattaData();

        const sfidaEl = document.createElement("div");
        sfidaEl.className = "fw-semibold";
        sfidaEl.textContent = ev.strEvent || `${ev.strHomeTeam} vs ${ev.strAwayTeam}`;

        testoBox.appendChild(dataEl);
        testoBox.appendChild(sfidaEl);
        riga.appendChild(testoBox);

        const punteggio = ev.getPunteggio();
        if (mostraBadgeRisultato && punteggio) {
            const badge = document.createElement("span");
            badge.className = "badge bg-success";
            badge.textContent = punteggio;
            riga.appendChild(badge);
        }

        riga.addEventListener("click", () => apriModaleEvento(ev));
        contenitore.appendChild(riga);
    });
}

/* Creazione di una card squadra */
function creaCardSquadra(squadra, isPreferitaCard) {
    const col = document.createElement("div");
    col.className = isPreferitaCard
        ? "col-12 col-md-6 col-lg-4"
        : "col-12 col-sm-6 col-md-4 col-lg-3";

    const card = document.createElement("div");
    card.className = "team-card h-100 p-3 d-flex flex-column align-items-center text-center";

    if (squadra.strBadge) {
        const img = document.createElement("img");
        img.src = squadra.strBadge;
        img.alt = squadra.strTeam;
        img.className = "team-badge mb-2";
        card.appendChild(img);
    }

    const nome = document.createElement("h3");
    nome.className = "h6 fw-bold mb-1";
    nome.textContent = squadra.strTeam;

    const lega = document.createElement("div");
    lega.className = "small text-secondary";
    lega.textContent = squadra.strLeague;

    const paese = document.createElement("div");
    paese.className = "small text-secondary mb-3";
    paese.textContent = squadra.strCountry;

    card.appendChild(nome);
    card.appendChild(lega);
    card.appendChild(paese);

    if (isPreferitaCard) {
        const btnRimuovi = document.createElement("button");
        btnRimuovi.type = "button";
        btnRimuovi.className = "btn btn-outline-danger btn-sm w-100 mt-auto";
        btnRimuovi.textContent = "Rimuovi";
        btnRimuovi.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePreferita(squadra);
        });
        card.appendChild(btnRimuovi);
    } else {
        const giaSalvata = isSquadraPreferita(squadra.idTeam);
        const btnFav = document.createElement("button");
        btnFav.type = "button";
        btnFav.className = giaSalvata
            ? "btn btn-secondary btn-sm w-100 mt-auto"
            : "btn btn-warning btn-sm fw-semibold w-100 mt-auto";
        btnFav.disabled = giaSalvata;
        btnFav.textContent = giaSalvata ? "Già nei preferiti" : "★ Aggiungi ai preferiti";
        btnFav.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePreferita(squadra);
        });
        card.appendChild(btnFav);
    }

    card.addEventListener("click", () => caricaDettagli(squadra));
    col.appendChild(card);
    return col;
}

/* Render della sezione squadre preferite */
function renderPreferiti() {
    preferitiList.textContent = "";

    if (preferiti.length === 0) {
        const col = document.createElement("div");
        col.className = "col-12";
        const msg = document.createElement("p");
        msg.className = "text-secondary fst-italic mb-0";
        msg.textContent = "Non hai ancora salvato nessuna squadra. Cercane una qui sopra e aggiungila ai preferiti.";
        col.appendChild(msg);
        preferitiList.appendChild(col);
        return;
    }

    preferiti.forEach(sq => {
        preferitiList.appendChild(creaCardSquadra(sq, true));
    });
}

/* Render delle squadre trovate applicando il filtro sport */
function renderSquadreTrovate() {
    risultatiList.textContent = "";

    const filtrate = sportSelezionato === "ALL"
        ? squadreTrovate
        : squadreTrovate.filter(sq => sq.strSport === sportSelezionato);

    if (filtrate.length === 0) {
        const col = document.createElement("div");
        col.className = "col-12";
        const msg = document.createElement("p");
        msg.className = "text-secondary mb-0";
        msg.textContent = squadreTrovate.length === 0
            ? "Cerca una squadra per visualizzare i risultati."
            : "Nessuna squadra trovata per questo sport.";
        col.appendChild(msg);
        risultatiList.appendChild(col);
        return;
    }

    filtrate.forEach(sq => {
        risultatiList.appendChild(creaCardSquadra(sq, false));
    });
}

/* Gestione submit del form di ricerca */
searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(debounceTimer);
    cercaSquadre(searchInput.value);
});

/* Gestione digitazione con debounce di 400ms */
searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        cercaSquadre(searchInput.value);
    }, 400);
});

/* Gestione pulsanti filtro per sport */
sportFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-sport");
    if (!btn) return;

    sportSelezionato = btn.dataset.sport;
    sportFilters.querySelectorAll(".btn-sport").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderSquadreTrovate();
});

/* Avvio iniziale dell'app */
renderSquadreTrovate();
caricaPreferiteAllAvvio();