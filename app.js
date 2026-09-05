// app.js

function renderAgenda() {
    const container = document.getElementById('agenda-container');
    container.innerHTML = ''; 

    // Capture the current time (Using exact provided context: Sept 5, 2026)
    const currentTime = new Date(); 
    
    // NOTE: Because current time is Sept 5, and events are Sept 9, they will appear active. 
    // To test the grey-out logic locally, uncomment the line below to simulate Sept 9 at 10:40 AM:
    // const currentTime = new Date("2026-09-09T10:40:00+05:30"); 

    agendaData.forEach(event => {
        // Parse the end time to determine if the event is over
        const timeSplit = event.time.split("-");
        const endTimeStr = timeSplit.length > 1 ? timeSplit[1].trim() : timeSplit[0].trim();
        
        // Construct standard ISO date string for comparison
        const eventEndDateTime = new Date(`${event.date}T${endTimeStr}:00+05:30`);
        
        const isPast = currentTime > eventEndDateTime;

        // Build the HTML for the row based on the source CSS structure
        const row = document.createElement('div');
        row.className = `row ${isPast ? 'past-event' : ''}`;
        
        row.innerHTML = `
            <div class="slotrows">
                <div class="rtitle">${event.title}</div>
                
                <div class="rmeta">
                    <span class="rfmt">${event.format}</span>
                    <span class="sep">•</span>
                    <span class="code">🕒 ${event.time}</span>
                    <span class="sep">•</span>
                    <span class="hall">📍 ${event.room}</span>
                </div>
                
                <div class="rppl"><b>Speakers:</b> ${event.speakers}</div>
                
                <div class="rtags">
                    <span class="tag">${event.track}</span>
                    ${isPast ? '<span class="tag completed">Completed</span>' : ''}
                </div>
            </div>
        `;
        
        container.appendChild(row);
    });
}

// Initialize when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", renderAgenda);