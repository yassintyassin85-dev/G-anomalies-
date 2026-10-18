/**
 * Application de Gestion des Compteurs d'Eau
 * Code JavaScript moderne, modulaire, autonome et sécurisé
 */

(function () {
  'use strict';

  // Clés de stockage LocalStorage
  const STORAGE_KEY_METERS = 'water_meters_v1_records';
  const STORAGE_KEY_LAST_AGENT = 'water_meters_v1_last_agent';

  // État de l'application
  let meters = [];
  let currentEditingId = null;
  let modalCallback = null;

  // Sélecteurs du DOM
  const elements = {
    // Vues
    viewHome: document.getElementById('view-home'),
    viewForm: document.getElementById('view-form'),

    // Accueil - Agent & Ajout
    agentInput: document.getElementById('agent-input'),
    btnAddMeter: document.getElementById('btn-add-meter'),
    agentErrorMsg: document.getElementById('agent-error-msg'),

    // Statistiques
    statTotalMeters: document.getElementById('stat-total-meters'),
    statTotalAgents: document.getElementById('stat-total-agents'),
    listCountBadge: document.getElementById('list-count-badge'),

    // Actions
    btnExportExcel: document.getElementById('btn-export-excel'),
    btnBackupJson: document.getElementById('btn-backup-json'),
    btnTriggerRestore: document.getElementById('btn-trigger-restore'),
    fileImportInput: document.getElementById('file-import-input'),

    // Recherche
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),

    // Liste des compteurs
    metersList: document.getElementById('meters-list'),
    emptyState: document.getElementById('empty-state'),

    // Formulaire
    meterForm: document.getElementById('meter-form'),
    formTitle: document.getElementById('form-title'),
    formModeBadge: document.getElementById('form-mode-badge'),
    formAgentDisplay: document.getElementById('form-agent-display'),
    editMeterId: document.getElementById('edit-meter-id'),
    meterNumberInput: document.getElementById('meter-number-input'),
    meterNumberError: document.getElementById('meter-number-error'),
    unitInput: document.getElementById('unit-input'),
    observationSelect: document.getElementById('observation-select'),
    prevSubscriberInput: document.getElementById('previous-subscriber-input'),
    newSubscriberInput: document.getElementById('new-subscriber-input'),
    btnCancelMeter: document.getElementById('btn-cancel-meter'),

    // Modal
    confirmModal: document.getElementById('confirm-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    btnModalCancel: document.getElementById('btn-modal-cancel'),
    btnModalConfirm: document.getElementById('btn-modal-confirm'),

    // Toasts
    toastContainer: document.getElementById('toast-container')
  };

  /**
   * Échappement HTML sécurisé contre les failles XSS
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Formater une date en format français lisible (ex: 18/10/2026 à 14:32)
   */
  function formatDateFr(isoString) {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} à ${hours}:${minutes}`;
    } catch (e) {
      return isoString;
    }
  }

  /**
   * Génération d'un identifiant unique fiable
   */
  function generateUniqueId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'cpt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Chargement des données depuis LocalStorage
   */
  function loadDataFromStorage() {
    try {
      // Chargement du dernier nom d'agent saisi
      const savedAgent = localStorage.getItem(STORAGE_KEY_LAST_AGENT);
      if (savedAgent && elements.agentInput) {
        elements.agentInput.value = savedAgent.trim();
      }

      // Chargement de la liste des compteurs
      const rawRecords = localStorage.getItem(STORAGE_KEY_METERS);
      if (rawRecords) {
        const parsed = JSON.parse(rawRecords);
        if (Array.isArray(parsed)) {
          meters = parsed;
        } else {
          meters = [];
        }
      } else {
        meters = [];
      }
    } catch (err) {
      console.error('Erreur lors de la lecture du LocalStorage :', err);
      showToast('Impossible de lire les données locales sauvegardées.', 'error');
      meters = [];
    }
  }

  /**
   * Sauvegarde des compteurs dans LocalStorage
   */
  function persistMeters() {
    try {
      localStorage.setItem(STORAGE_KEY_METERS, JSON.stringify(meters));
      return true;
    } catch (err) {
      console.error('Erreur lors de l’écriture dans LocalStorage :', err);
      showToast('Erreur d’espace ou de permission lors de la sauvegarde.', 'error');
      return false;
    }
  }

  /**
   * Sauvegarde du nom de l'agent dans LocalStorage
   */
  function persistAgentName(name) {
    try {
      if (name) {
        localStorage.setItem(STORAGE_KEY_LAST_AGENT, name.trim());
      }
    } catch (err) {
      console.warn('Impossible de sauvegarder le nom de l’agent :', err);
    }
  }

  /**
   * Affichage d'une notification Toast temporaire
   */
  function showToast(message, type = 'success') {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icône selon le type
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;flex-shrink:0" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;flex-shrink:0" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;flex-shrink:0" fill="currentColor"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 250);
    }, 3200);
  }

  /**
   * Calcul et mise à jour des statistiques
   */
  function updateStats() {
    const totalMeters = meters.length;
    
    // Nombre d'agents distincts
    const uniqueAgents = new Set();
    meters.forEach(m => {
      if (m.agentName && m.agentName.trim()) {
        uniqueAgents.add(m.agentName.trim().toLowerCase());
      }
    });
    const totalAgents = uniqueAgents.size;

    elements.statTotalMeters.textContent = totalMeters;
    elements.statTotalAgents.textContent = totalAgents;
    elements.listCountBadge.textContent = `${totalMeters} compteur${totalMeters > 1 ? 's' : ''}`;
  }

  /**
   * Rendu de la classe CSS du badge d'observation
   */
  function getObservationBadgeClass(obs) {
    switch (obs) {
      case 'Compteur détérioré':
        return 'obs-deteriore';
      case 'Compteur mal posé':
        return 'obs-mal-pose';
      case 'Compteur mal classé':
        return 'obs-mal-classe';
      case 'Compteur intérieur':
        return 'obs-interieur';
      default:
        return 'obs-autre';
    }
  }

  /**
   * Rendu de la liste des cartes de compteurs
   */
  function renderMetersList(filterText = '') {
    const query = filterText.trim().toLowerCase();
    
    let filtered = meters;
    if (query) {
      filtered = meters.filter(m => {
        return (m.meterNumber && m.meterNumber.toLowerCase().includes(query)) ||
               (m.agentName && m.agentName.toLowerCase().includes(query)) ||
               (m.unit && m.unit.toLowerCase().includes(query)) ||
               (m.observation && m.observation.toLowerCase().includes(query)) ||
               (m.previousSubscriber && m.previousSubscriber.toLowerCase().includes(query)) ||
               (m.newSubscriber && m.newSubscriber.toLowerCase().includes(query));
      });
    }

    elements.metersList.innerHTML = '';

    if (meters.length === 0) {
      elements.emptyState.classList.remove('hidden');
      elements.emptyState.querySelector('.empty-title').textContent = 'Aucun compteur enregistré';
      elements.emptyState.querySelector('.empty-desc').textContent = 
        'Renseignez le nom de l’agent ci-dessus et cliquez sur le bouton carré « + » pour enregistrer votre premier compteur d’eau.';
      return;
    }

    if (filtered.length === 0) {
      elements.emptyState.classList.remove('hidden');
      elements.emptyState.querySelector('.empty-title').textContent = 'Aucun résultat trouvé';
      elements.emptyState.querySelector('.empty-desc').textContent = 
        `Aucun compteur ne correspond à votre recherche « ${escapeHtml(filterText)} ».`;
      return;
    }

    elements.emptyState.classList.add('hidden');

    // Affichage des cartes triées par date de modification ou de création descendante
    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    sorted.forEach(meter => {
      const card = document.createElement('article');
      card.className = 'meter-card';
      card.dataset.id = meter.id;

      const obsClass = getObservationBadgeClass(meter.observation);
      const displayDate = formatDateFr(meter.updatedAt || meter.createdAt);
      const isModified = meter.updatedAt && meter.updatedAt !== meter.createdAt;

      card.innerHTML = `
        <div class="meter-card-header">
          <div class="meter-number-box">
            <svg viewBox="0 0 24 24" class="meter-dial-icon" aria-hidden="true">
              <path fill="currentColor" d="M12 4a8 8 0 0 0-8 8c0 3.31 2.01 6.16 4.9 7.37L10 17.5a6.002 6.002 0 0 1-4-5.5 6 6 0 1 1 12 0c0 2.45-1.48 4.56-3.6 5.5l1.1 1.87A7.994 7.994 0 0 0 20 12a8 8 0 0 0-8-8zm-1 5h2v4.59l2.71 2.7-1.42 1.42L11 14.41V9z"/>
            </svg>
            <span class="meter-number">${escapeHtml(meter.meterNumber)}</span>
          </div>
          <span class="observation-badge ${obsClass}">${escapeHtml(meter.observation || 'Autre')}</span>
        </div>

        <div class="meter-card-body">
          <div class="info-row">
            <span class="info-label">Agent :</span>
            <span class="info-value">${escapeHtml(meter.agentName || 'Non renseigné')}</span>
          </div>

          <div class="info-row">
            <span class="info-label">Unité :</span>
            <span class="info-value">${meter.unit ? escapeHtml(meter.unit) : '<em style="color:#87948e;font-weight:400">Non précisée</em>'}</span>
          </div>

          <div class="info-subscribers">
            <div class="sub-item">
              <span class="sub-label">Ancien abonné :</span>
              <span class="sub-val">${meter.previousSubscriber ? escapeHtml(meter.previousSubscriber) : '—'}</span>
            </div>
            <div class="sub-item">
              <span class="sub-label">Nouvel abonné :</span>
              <span class="sub-val">${meter.newSubscriber ? escapeHtml(meter.newSubscriber) : '—'}</span>
            </div>
          </div>
        </div>

        <div class="meter-date-row">
          <svg viewBox="0 0 24 24" class="date-icon" fill="currentColor">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
          </svg>
          <span>${isModified ? 'Modifié le ' : 'Enregistré le '} ${displayDate}</span>
        </div>

        <div class="meter-card-actions">
          <button type="button" class="btn btn-card-edit" data-action="edit" data-id="${meter.id}">
            <svg viewBox="0 0 24 24" class="btn-icon" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Modifier
          </button>
          <button type="button" class="btn btn-card-delete" data-action="delete" data-id="${meter.id}">
            <svg viewBox="0 0 24 24" class="btn-icon" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            Supprimer
          </button>
        </div>
      `;

      elements.metersList.appendChild(card);
    });
  }

  /**
   * Bascule vers la vue Formulaire (Ajout ou Modification)
   */
  function openForm(meterToEdit = null) {
    const currentAgent = elements.agentInput.value.trim();

    // Réinitialisation du formulaire
    elements.meterForm.reset();
    elements.meterNumberError.classList.remove('visible');
    elements.meterNumberInput.classList.remove('is-invalid');

    if (meterToEdit) {
      // Mode MODIFICATION
      currentEditingId = meterToEdit.id;
      elements.editMeterId.value = meterToEdit.id;
      elements.formTitle.textContent = 'Modifier le compteur';
      elements.formModeBadge.textContent = 'Modification';
      elements.formAgentDisplay.textContent = meterToEdit.agentName || currentAgent || 'Non défini';

      elements.meterNumberInput.value = meterToEdit.meterNumber || '';
      elements.unitInput.value = meterToEdit.unit || '';
      elements.observationSelect.value = meterToEdit.observation || 'Autre';
      elements.prevSubscriberInput.value = meterToEdit.previousSubscriber || '';
      elements.newSubscriberInput.value = meterToEdit.newSubscriber || '';
    } else {
      // Mode AJOUT
      currentEditingId = null;
      elements.editMeterId.value = '';
      elements.formTitle.textContent = 'Ajouter un compteur';
      elements.formModeBadge.textContent = 'Nouveau';
      elements.formAgentDisplay.textContent = currentAgent;

      elements.observationSelect.value = 'Compteur mal posé';
    }

    elements.viewHome.classList.add('hidden');
    elements.viewForm.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      elements.meterNumberInput.focus();
    }, 150);
  }

  /**
   * Retour à la vue Accueil
   */
  function returnToHome() {
    elements.viewForm.classList.add('hidden');
    elements.viewHome.classList.remove('hidden');
    currentEditingId = null;
    elements.meterNumberError.classList.remove('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Enregistrement du formulaire (Ajout ou Modification)
   */
  function handleFormSubmit(e) {
    e.preventDefault();

    const meterNumber = elements.meterNumberInput.value.trim();
    if (!meterNumber) {
      elements.meterNumberError.classList.add('visible');
      elements.meterNumberInput.focus();
      return;
    }

    const currentAgent = (currentEditingId 
      ? elements.formAgentDisplay.textContent 
      : elements.agentInput.value).trim() || 'Agent non spécifié';

    const unit = elements.unitInput.value.trim();
    const observation = elements.observationSelect.value;
    const prevSub = elements.prevSubscriberInput.value.trim();
    const newSub = elements.newSubscriberInput.value.trim();
    const nowIso = new Date().toISOString();

    if (currentEditingId) {
      // Mise à jour SANS doublon
      const index = meters.findIndex(m => m.id === currentEditingId);
      if (index !== -1) {
        meters[index] = {
          ...meters[index],
          meterNumber: meterNumber,
          unit: unit,
          observation: observation,
          previousSubscriber: prevSub,
          newSubscriber: newSub,
          updatedAt: nowIso
        };
        showToast('Compteur modifié avec succès !', 'success');
      } else {
        showToast('Erreur : le compteur sélectionné est introuvable.', 'error');
      }
    } else {
      // Nouvel ajout
      const newMeter = {
        id: generateUniqueId(),
        agentName: currentAgent,
        meterNumber: meterNumber,
        unit: unit,
        observation: observation,
        previousSubscriber: prevSub,
        newSubscriber: newSub,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      meters.push(newMeter);
      showToast('Compteur enregistré avec succès !', 'success');
    }

    persistMeters();
    updateStats();
    renderMetersList(elements.searchInput.value);
    returnToHome();
  }

  /**
   * Modal de confirmation
   */
  function showConfirmModal(title, message, onConfirm) {
    elements.modalTitle.textContent = title;
    elements.modalMessage.textContent = message;
    modalCallback = onConfirm;
    elements.confirmModal.classList.remove('hidden');
  }

  function hideConfirmModal() {
    elements.confirmModal.classList.add('hidden');
    modalCallback = null;
  }

  /**
   * Suppression d'un compteur
   */
  function handleDeleteMeter(id) {
    const meter = meters.find(m => m.id === id);
    if (!meter) return;

    showConfirmModal(
      'Supprimer ce compteur ?',
      `Êtes-vous sûr de vouloir supprimer définitivement le compteur N° « ${meter.meterNumber} » ? Cette action est irréversible.`,
      () => {
        meters = meters.filter(m => m.id !== id);
        persistMeters();
        updateStats();
        renderMetersList(elements.searchInput.value);
        showToast('Le compteur a été supprimé.', 'success');
      }
    );
  }

  /**
   * Déclencheur du téléchargement d'un fichier (compatible Web & Android WebView)
   */
  function triggerFileDownload(filename, mimeType, dataBlob, base64Content = null) {
    // Si une passerelle native Android est disponible, l'utiliser pour un partage direct
    if (window.AndroidBridge && typeof window.AndroidBridge.saveAndShareFile === 'function' && base64Content) {
      try {
        window.AndroidBridge.saveAndShareFile(filename, mimeType, base64Content);
        return;
      } catch (err) {
        console.warn('Erreur passerelle Android, repli sur téléchargement navigateur :', err);
      }
    }

    // Téléchargement standard navigateur
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /**
   * EXPORTATION EXCEL OBLIGATOIRE (.xlsx avec SheetJS)
   * Ordre exact des colonnes imposé :
   * 1. Nom de l'agent
   * 2. Numéro du compteur
   * 3. Unité
   * 4. Observation
   * 5. Ancien abonné
   * 6. Nouvel abonné
   * 7. Date de création
   * 8. Dernière modification
   */
  function exportToExcel() {
    if (meters.length === 0) {
      showToast('Aucun compteur à exporter. Enregistrez au moins un compteur.', 'info');
      return;
    }

    // Vérifier si la bibliothèque SheetJS (XLSX) est chargée
    if (typeof XLSX === 'undefined') {
      console.warn('SheetJS non disponible, proposition de repli CSV.');
      const useCsv = confirm(
        'La bibliothèque Excel avancée n’a pas pu être initialisée.\n' +
        'Voulez-vous exporter vos données au format CSV compatible avec Microsoft Excel ?'
      );
      if (useCsv) {
        exportToCsvFallback();
      }
      return;
    }

    try {
      // 1. Préparation des données dans l'ordre strict demandé
      const headers = [
        "Nom de l'agent",
        "Numéro du compteur",
        "Unité",
        "Observation",
        "Ancien abonné",
        "Nouvel abonné",
        "Date de création",
        "Dernière modification"
      ];

      const rows = meters.map(m => [
        m.agentName || '',
        m.meterNumber || '',
        m.unit || '',
        m.observation || '',
        m.previousSubscriber || '',
        m.newSubscriber || '',
        formatDateFr(m.createdAt),
        formatDateFr(m.updatedAt || m.createdAt)
      ]);

      // Assemblage de la feuille
      const worksheetData = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // 2. Ajustement automatique de la largeur des colonnes
      const colWidths = headers.map((header, colIndex) => {
        let maxLen = header.length;
        rows.forEach(row => {
          const val = row[colIndex] ? String(row[colIndex]) : '';
          if (val.length > maxLen) {
            maxLen = val.length;
          }
        });
        // Largeur minimale de 14 et marge de lisibilité
        return { wch: Math.min(Math.max(maxLen + 3, 14), 45) };
      });
      worksheet['!cols'] = colWidths;

      // 3. Création du classeur avec la feuille nommée « Compteurs »
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Compteurs');

      // 4. Génération binaire et téléchargement
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      // Conversion base64 pour passerelle Android éventuelle
      let base64 = null;
      try {
        const bytes = new Uint8Array(excelBuffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64 = btoa(binary);
      } catch (b64Err) {
        console.warn('Erreur conversion b64 :', b64Err);
      }

      triggerFileDownload('Donnees_compteurs.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', blob, base64);
      showToast('Export Excel « Donnees_compteurs.xlsx » généré avec succès !', 'success');
    } catch (err) {
      console.error('Erreur lors de l’export Excel :', err);
      showToast('Une erreur est survenue lors de l’exportation Excel.', 'error');
    }
  }

  /**
   * Repli CSV avec encodage UTF-8 BOM pour conservation parfaite des accents dans Microsoft Excel
   */
  function exportToCsvFallback() {
    const headers = [
      "Nom de l'agent",
      "Numéro du compteur",
      "Unité",
      "Observation",
      "Ancien abonné",
      "Nouvel abonné",
      "Date de création",
      "Dernière modification"
    ];

    const escapeCsv = (val) => {
      const str = val ? String(val) : '';
      return `"${str.replace(/"/g, '""')}"`;
    };

    let csvContent = '\uFEFF'; // UTF-8 BOM indispensable pour Excel
    csvContent += headers.map(escapeCsv).join(';') + '\r\n';

    meters.forEach(m => {
      const row = [
        m.agentName || '',
        m.meterNumber || '',
        m.unit || '',
        m.observation || '',
        m.previousSubscriber || '',
        m.newSubscriber || '',
        formatDateFr(m.createdAt),
        formatDateFr(m.updatedAt || m.createdAt)
      ];
      csvContent += row.map(escapeCsv).join(';') + '\r\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerFileDownload('Donnees_compteurs.csv', 'text/csv', blob);
    showToast('Export CSV compatible Excel téléchargé.', 'success');
  }

  /**
   * SAUVEGARDE DES DONNÉES EN FICHIER JSON
   */
  function backupToJson() {
    if (meters.length === 0) {
      showToast('Aucun compteur à sauvegarder.', 'info');
      return;
    }

    try {
      const backupData = {
        appName: 'Gestion des compteurs',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        totalCount: meters.length,
        meters: meters
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      
      let base64 = null;
      try {
        base64 = btoa(unescape(encodeURIComponent(jsonString)));
      } catch (e) {
        console.warn(e);
      }

      const today = new Date().toISOString().slice(0, 10);
      const filename = `Sauvegarde_compteurs_${today}.json`;
      triggerFileDownload(filename, 'application/json', blob, base64);
      showToast('Sauvegarde JSON téléchargée avec succès !', 'success');
    } catch (err) {
      console.error('Erreur sauvegarde JSON :', err);
      showToast('Erreur lors de la création du fichier de sauvegarde.', 'error');
    }
  }

  /**
   * IMPORTATION ET RESTAURATION D'UNE SAUVEGARDE JSON
   */
  function handleFileRestore(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const content = event.target.result;
        const parsed = JSON.parse(content);

        let importedMeters = null;
        if (Array.isArray(parsed)) {
          importedMeters = parsed;
        } else if (parsed && Array.isArray(parsed.meters)) {
          importedMeters = parsed.meters;
        }

        if (!importedMeters) {
          throw new Error('Format de fichier invalide : aucune liste de compteurs trouvée.');
        }

        // Validation minimale de la structure des éléments
        const validRecords = importedMeters.filter(item => {
          return item && typeof item === 'object' && (item.meterNumber || item.id);
        });

        if (validRecords.length === 0 && importedMeters.length > 0) {
          throw new Error('Le fichier ne contient aucun enregistrement de compteur valide.');
        }

        // Demande de confirmation avant remplacement
        showConfirmModal(
          'Remplacer les données actuelles ?',
          `Le fichier contient ${validRecords.length} compteur(s). L’importation va remplacer les données actuellement enregistrées. Voulez-vous continuer ?`,
          () => {
            // Nettoyage et normalisation des identifiants et dates
            meters = validRecords.map(item => ({
              id: item.id || generateUniqueId(),
              agentName: item.agentName || 'Agent importé',
              meterNumber: String(item.meterNumber || '').trim(),
              unit: item.unit ? String(item.unit).trim() : '',
              observation: item.observation || 'Autre',
              previousSubscriber: item.previousSubscriber ? String(item.previousSubscriber).trim() : '',
              newSubscriber: item.newSubscriber ? String(item.newSubscriber).trim() : '',
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
            }));

            persistMeters();
            updateStats();
            renderMetersList(elements.searchInput.value);
            showToast(`${meters.length} compteur(s) restauré(s) avec succès !`, 'success');
          }
        );
      } catch (err) {
        console.error('Erreur import JSON :', err);
        showToast(`Échec de l’importation : ${err.message}`, 'error');
      } finally {
        // Réinitialisation du champ pour permettre de réimporter le même fichier
        elements.fileImportInput.value = '';
      }
    };

    reader.onerror = function () {
      showToast('Erreur lors de la lecture du fichier.', 'error');
      elements.fileImportInput.value = '';
    };

    reader.readAsText(file, 'UTF-8');
  }

  /**
   * Écouteurs d'événements
   */
  function setupEventListeners() {
    // 1. Bouton carré "+" pour ajouter un compteur
    elements.btnAddMeter.addEventListener('click', () => {
      const agentName = elements.agentInput.value.trim();
      if (!agentName) {
        elements.agentErrorMsg.classList.remove('hidden');
        elements.agentInput.focus();
        elements.agentInput.classList.add('is-invalid');
        return;
      }

      elements.agentErrorMsg.classList.add('hidden');
      elements.agentInput.classList.remove('is-invalid');
      persistAgentName(agentName);
      openForm(null);
    });

    // Masquage de l'erreur agent lors de la saisie
    elements.agentInput.addEventListener('input', () => {
      if (elements.agentInput.value.trim()) {
        elements.agentErrorMsg.classList.add('hidden');
        elements.agentInput.classList.remove('is-invalid');
      }
      persistAgentName(elements.agentInput.value);
    });

    // 2. Soumission du formulaire (Ajout/Modification)
    elements.meterForm.addEventListener('submit', handleFormSubmit);

    // 3. Bouton Annuler et retourner
    elements.btnCancelMeter.addEventListener('click', returnToHome);

    // Effacer l'erreur du numéro de compteur dès que l'utilisateur tape
    elements.meterNumberInput.addEventListener('input', () => {
      if (elements.meterNumberInput.value.trim()) {
        elements.meterNumberError.classList.remove('visible');
      }
    });

    // 4. Délégation d'événements pour les boutons Modifier et Supprimer de la liste
    elements.metersList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'edit') {
        const meter = meters.find(m => m.id === id);
        if (meter) {
          openForm(meter);
        }
      } else if (action === 'delete') {
        handleDeleteMeter(id);
      }
    });

    // 5. Recherche et filtrage
    elements.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val) {
        elements.btnClearSearch.classList.remove('hidden');
      } else {
        elements.btnClearSearch.classList.add('hidden');
      }
      renderMetersList(val);
    });

    elements.btnClearSearch.addEventListener('click', () => {
      elements.searchInput.value = '';
      elements.btnClearSearch.classList.add('hidden');
      renderMetersList('');
      elements.searchInput.focus();
    });

    // 6. Exportation Excel
    elements.btnExportExcel.addEventListener('click', exportToExcel);

    // 7. Sauvegarde JSON
    elements.btnBackupJson.addEventListener('click', backupToJson);

    // 8. Importation / Restauration JSON
    elements.btnTriggerRestore.addEventListener('click', () => {
      elements.fileImportInput.click();
    });
    elements.fileImportInput.addEventListener('change', handleFileRestore);

    // 9. Modal de confirmation
    elements.btnModalCancel.addEventListener('click', hideConfirmModal);
    elements.btnModalConfirm.addEventListener('click', () => {
      if (typeof modalCallback === 'function') {
        modalCallback();
      }
      hideConfirmModal();
    });

    // Fermeture du modal sur clic en dehors de la boîte
    elements.confirmModal.addEventListener('click', (e) => {
      if (e.target === elements.confirmModal) {
        hideConfirmModal();
      }
    });
  }

  /**
   * Initialisation de l'application
   */
  function init() {
    loadDataFromStorage();
    setupEventListeners();
    updateStats();
    renderMetersList();
  }

  // Lancement dès que le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
