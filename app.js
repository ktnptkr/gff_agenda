// 5. Native Mobile Sharing & Exports
function exportCalendar(type) {
    const savedEvents = AGENDA_DATA.filter(e => savedSessionIds.includes(e.id));
    if (savedEvents.length === 0) {
        showToast("No saved sessions in My Agenda to export.", "⚠️");
        return;
    }
    exportICSFile(savedEvents);
}

function exportICSFile(events) {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//GFF 2026 Agenda//EN\n";
    
    events.forEach(e => {
        const { start, end } = parseTimes(e.Date, e.Time);
        const formatDate = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        icsContent += "BEGIN:VEVENT\n";
        icsContent += `UID:gff2026-${e.id}@globalfintechfest.com\n`;
        icsContent += `DTSTAMP:${formatDate(new Date())}\n`;
        icsContent += `DTSTART:${formatDate(start)}\n`;
        icsContent += `DTEND:${formatDate(end)}\n`;
        icsContent += `SUMMARY:${e["Activity Name"]}\n`;
        icsContent += `LOCATION:${e["Location / Room"] || 'Mumbai'}\n`;
        icsContent += `DESCRIPTION:${e.Description ? e.Description.replace(/\n/g, '\\n') : ''}\n`;
        icsContent += "END:VEVENT\n";
    });
    
    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'GFF_2026_My_Agenda.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Calendar file downloaded!", "📥");
}

function shareItinerary() {
    if (savedSessionIds.length === 0) {
        showToast("No saved sessions to share.", "⚠️");
        return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}#saved=${savedSessionIds.join(',')}`;
    
    // Trigger Native Phone Share Sheet (WhatsApp, Telegram, SMS, etc.)
    if (navigator.share) {
        navigator.share({
            title: 'My GFF 2026 Itinerary',
            text: 'Check out my customized schedule for Global Fintech Fest 2026:',
            url: shareUrl,
        }).catch((error) => {
            console.log('Share canceled or failed:', error);
        });
    } else {
        // Fallback for desktop/unsupported browsers
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast("Itinerary link copied to clipboard!", "🔗");
        });
    }
}

function shareSession(id, eventObj) {
    if(eventObj) eventObj.stopPropagation();
    const event = AGENDA_DATA.find(e => e.id === id);
    const shareUrl = `${window.location.origin}${window.location.pathname}#session=${id}`;
    
    // Trigger Native Phone Share Sheet
    if (navigator.share) {
        navigator.share({
            title: event ? event["Activity Name"] : 'GFF 2026 Session',
            text: `Check out this session at GFF 2026: "${event ? event["Activity Name"] : ''}" (${event?.Time || ''} at ${event?.["Location / Room"] || ''})`,
            url: shareUrl,
        }).catch((error) => {
            console.log('Share canceled or failed:', error);
        });
    } else {
        // Fallback for desktop/unsupported browsers
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast("Session link copied to clipboard!", "🔗");
        });
    }
}