// State
let currentDate = "2026-09-09";
let currentTrack = "all";
let currentFormat = "all";
let searchQuery = "";

// Time context for greying out (Current Time is Sept 5, 2026, so no events are greyed out naturally yet)
// Change `new Date()` to `new Date("2026-09-09T11:00:00+05:30")` to test the grey-out feature.
const CURRENT_TIME = new Date(); 

// DOM Elements
const feed = document.getElementById('event-feed');
const dateFilters = document.getElementById('date-filters');
const trackFilter = document.getElementById('track-filter');
const formatFilter = document.getElementById('format-filter');
const searchInput = document.getElementById('search-input');
const searchToggle = document.getElementById('search-toggle');
const searchBar = document.getElementById('search-bar');

// Drawer Elements
const drawerOverlay = document.getElementById('drawer-overlay');
const drawer = document.getElementById('drawer');
const closeDrawerBtn = document.getElementById('close-drawer');

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    if (typeof AGENDA_DATA === 'undefined') {
        feed.innerHTML = '<p class="text-red-500 text-center p-4">Error: data.js not loaded. Please run build_data.py to generate the data.</p>';
        return;
    }
    initFilters();
    renderAgenda();
});

function initFilters() {
    // Extract unique dates, tracks, formats
    const dates = [...new Set(AGENDA_DATA.map(e => e.Date))].sort();
    const tracks = [...new Set(AGENDA_DATA.map(e => e.Tracks).filter(Boolean))];
    const formats = [...new Set(AGENDA_DATA.map(e => e.Format).filter(Boolean))];

    // Populate Dates
    currentDate = dates[0];
    dateFilters.innerHTML = dates.map(date => {
        const d = new Date(date);
        const day = d.getDate();
        const month = d.toLocaleString('default', { month: 'short' });
        return `<button onclick="setDate('${date}')" class="date-btn px-5 py-2 rounded-full text-sm font-semibold transition ${date === currentDate ? 'bg-navy text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-date="${date}">
            ${day} ${month}
        </button>`;
    }).join('');

    // Populate Dropdowns (Handling comma separated tracks/formats if they exist)
    const uniqueTracks = [...new Set(tracks.flatMap(t => t.split(', ')))].sort();
    uniqueTracks.forEach(t => trackFilter.innerHTML += `<option value="${t}">${t}</option>`);
    
    formats.sort().forEach(f => formatFilter.innerHTML += `<option value="${f}">${f}</option>`);

    // Listeners
    trackFilter.addEventListener('change', e => { currentTrack = e.target.value; renderAgenda(); });
    formatFilter.addEventListener('change', e => { currentFormat = e.target.value; renderAgenda(); });
    searchInput.addEventListener('input', e => { searchQuery = e.target.value.toLowerCase(); renderAgenda(); });
    
    searchToggle.addEventListener('click', () => {
        searchBar.classList.toggle('hidden');
        if(!searchBar.classList.contains('hidden')) searchInput.focus();
    });
}

function setDate(date) {
    currentDate = date;
    document.querySelectorAll('.date-btn').forEach(btn => {
        if (btn.getAttribute('data-date') === date) {
            btn.className = "date-btn px-5 py-2 rounded-full text-sm font-semibold transition bg-navy text-white shadow-md";
        } else {
            btn.className = "date-btn px-5 py-2 rounded-full text-sm font-semibold transition bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";
        }
    });
    renderAgenda();
}

function parseEndTime(dateStr, timeStr) {
    if (!timeStr) return new Date("2099-01-01");
    const timeParts = timeStr.split("-");
    const endStr = timeParts.length > 1 ? timeParts[1].trim() : timeParts[0].trim();
    return new Date(`${dateStr}T${endStr}:00+05:30`);
}

function renderAgenda() {
    const filtered = AGENDA_DATA.filter(e => {
        if (e.Date !== currentDate) return false;
        if (currentTrack !== 'all' && !e.Tracks?.includes(currentTrack)) return false;
        if (currentFormat !== 'all' && e.Format !== currentFormat) return false;
        if (searchQuery) {
            const str = `${e["Activity Name"]} ${e["Speaker / Participant / Moderator"]} ${e["Company Name"]}`.toLowerCase();
            if (!str.includes(searchQuery)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        feed.innerHTML = `<div class="text-center py-12 text-slate-500 font-medium">No sessions found for these filters.</div>`;
        return;
    }

    feed.innerHTML = filtered.map((event, index) => {
        const endTime = parseEndTime(event.Date, event.Time);
        const isPast = CURRENT_TIME > endTime;
        
        return `
        <div onclick="openDrawer(${index})" class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md hover:border-brand/30 transition relative overflow-hidden ${isPast ? 'past-event' : ''}">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-brand"></div>
            
            <div class="flex justify-between items-start mb-2">
                <span class="text-sm font-bold text-brand flex items-center gap-1">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> 
                    ${event.Time || 'TBA'}
                </span>
                ${isPast ? '<span class="text-xs font-bold px-2 py-1 rounded-md past-event-badge">Completed</span>' : ''}
            </div>
            
            <h3 class="text-base font-bold text-navy leading-tight mb-2">${event["Activity Name"] || 'Untitled Session'}</h3>
            
            <div class="flex items-center gap-2 text-xs text-slate-500 font-medium mb-4">
                <span class="bg-slate-100 px-2 py-1 rounded text-slate-600">${event.Format || 'Session'}</span>
                <span>•</span>
                <span class="flex items-center gap-1"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> ${event["Location / Room"] || 'TBA'}</span>
            </div>
        </div>
        `;
    }).join('');

    // Attach data to window for drawer access
    window.currentViewData = filtered;
}

// Drawer Logic
function openDrawer(index) {
    const event = window.currentViewData[index];
    
    document.getElementById('drawer-format').innerText = event.Format || 'Session';
    document.getElementById('drawer-title').innerText = event["Activity Name"] || 'Untitled Session';
    document.getElementById('drawer-time').innerText = event.Time || 'TBA';
    document.getElementById('drawer-room').innerText = event["Location / Room"] || 'TBA';
    document.getElementById('drawer-desc').innerText = event.Description || 'No description available.';
    document.getElementById('drawer-speakers').innerText = event["Speaker / Participant / Moderator"] || 'TBA';
    document.getElementById('drawer-companies').innerText = event["Company Name"] || 'TBA';
    document.getElementById('drawer-track').innerText = event.Tracks || 'General';

    drawerOverlay.classList.remove('hidden');
    // slight delay to allow display block to render before opacity transition
    setTimeout(() => {
        drawerOverlay.classList.remove('opacity-0');
        drawer.classList.remove('translate-y-full');
    }, 10);
}

function closeDrawer() {
    drawerOverlay.classList.add('opacity-0');
    drawer.classList.add('translate-y-full');
    setTimeout(() => {
        drawerOverlay.classList.add('hidden');
    }, 300);
}

closeDrawerBtn.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);