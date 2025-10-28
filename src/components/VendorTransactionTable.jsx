import { useState, useEffect } from 'react';
import apiService from '../services/api';
import '../styles/VendorTransactionTable.css';

const VendorTransactionTable = () => {
  const [transactions, setTransactions] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [wireFilter, setWireFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [printedPages, setPrintedPages] = useState(new Set()); // Track which pages were printed
  const [showWireSummary, setShowWireSummary] = useState(true); // Toggle for Wire Summary table
  const itemsPerPage = 20;

  // Print function - mark current page as printed in database
  const handlePrint = async () => {
    if (selectedVendor) {
      try {
        // Mark current page as printed in database
        await apiService.markPageAsPrinted(selectedVendor, currentPage);
        
        // Update local state
        const pageKey = `${selectedVendor}-page-${currentPage}`;
        setPrintedPages(prev => new Set([...prev, pageKey]));
      } catch (error) {
        alert('Failed to save print status: ' + error.message);
        return; // Don't print if save failed
      }
    }
    window.print();
  };

  // Screenshot function
  const handleScreenshot = async () => {
    try {
      // Import html2canvas dynamically
      const html2canvas = (await import('html2canvas')).default;
      
      // Get the table wrapper element
      const element = document.querySelector('.vendor-transaction-table-wrapper');
      if (!element) {
        alert('Table not found!');
        return;
      }

      // Show loading message
      const originalContent = element.innerHTML;
      
      // Take screenshot
      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileName = selectedVendor 
          ? `${selectedVendor}_transactions_page${currentPage}_${new Date().toISOString().split('T')[0]}.png`
          : `all_vendors_transactions_${new Date().toISOString().split('T')[0]}.png`;
        
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert('✅ Screenshot saved successfully!');
      });
    } catch (error) {
      alert('❌ Failed to take screenshot. Please install html2canvas: npm install html2canvas');
    }
  };

  // Clear print history from database
  const handleClearPrintHistory = async () => {
    if (window.confirm('Are you sure you want to clear all print history?')) {
      try {
        await apiService.clearAllPrintStatuses();
        setPrintedPages(new Set());
        alert('Print history cleared successfully!');
      } catch (error) {
        alert('Failed to clear print history: ' + error.message);
      }
    }
  };

  // Clear print history for a specific page
  const handleClearSpecificPage = async () => {
    if (!selectedVendor) {
      alert('⚠️ Please select a vendor first!');
      return;
    }
    
    const pageNumber = prompt(`Enter the page number to clear history for ${selectedVendor}:\n(Total pages: ${totalPages})`);
    
    if (pageNumber === null) return; // User cancelled
    
    const pageNum = parseInt(pageNumber);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
      alert(`⚠️ Please enter a valid page number between 1 and ${totalPages}`);
      return;
    }
    
    if (window.confirm(`Clear print history for ${selectedVendor} - Page ${pageNum}?`)) {
      try {
        await apiService.clearPagePrintStatus(selectedVendor, pageNum);
        
        // Update local state
        const pageKey = `${selectedVendor}-page-${pageNum}`;
        const newPrintedPages = new Set(printedPages);
        newPrintedPages.delete(pageKey);
        setPrintedPages(newPrintedPages);
        
        alert(`✅ Print history cleared for Page ${pageNum}!`);
      } catch (error) {
        alert('❌ Failed to clear page history: ' + error.message);
      }
    }
  };

  // Load vendors, transactions, and print statuses
  useEffect(() => {
    loadData();
    loadPrintStatuses();
  }, []);

  // Load print statuses from database
  const loadPrintStatuses = async () => {
    try {
      const statuses = await apiService.getAllPrintStatuses();
      const printedSet = new Set(
        statuses.map(s => `${s.vendorName}-page-${s.pageNumber}`)
      );
      setPrintedPages(printedSet);
    } catch (error) {
      // Error loading print statuses
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [vendorsData, inTransactions, outTransactions] = await Promise.all([
        apiService.getAllVendors(),
        apiService.getTransactionsByType('IN'),
        apiService.getTransactionsByType('OUT')
      ]);

      setVendors(vendorsData);
      
      // Combine and process transactions
      const allTransactions = [...inTransactions, ...outTransactions];
      processTransactions(allTransactions);
    } catch (error) {
      alert('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const processTransactions = (allTransactions) => {
    // Create individual rows for each transaction with Sr.No
    const processedTransactions = allTransactions.map((trans, index) => {
      // Use inDate/outDate for both display and sorting
      const transactionDate = trans.inDate || trans.outDate || trans.createdAt;
      
      return {
        id: trans.id,
        srNo: index + 1, // Serial Number for each transaction
        vendor: trans.vendor,
        wire: trans.item,
        design: trans.payalType || '',
        labourCharges: trans.type === 'IN' ? (trans.price || 0) : 0,
        qtyOut: trans.type === 'OUT' ? (trans.qty || 0) : 0,
        qtyIn: trans.type === 'IN' ? (trans.qty || 0) : 0,
        outIn: trans.type,
        remainingWeight: 0, // Will be calculated cumulatively
        date: transactionDate, // For display
        sortDate: transactionDate, // For sorting - use transaction date
        type: trans.type,
        wireId: '', // Will be assigned based on FIFO
        wireIdDetails: [], // For IN transactions, track which Wire IDs were reduced
        pdfFile: null,
        imgFile: null
      };
    });

    // Sort by transaction date first, then by createdAt time for same-date entries
    processedTransactions.sort((a, b) => {
      // Get date-only strings (YYYY-MM-DD) for comparison
      const dateOnlyA = new Date(a.sortDate).toISOString().split('T')[0];
      const dateOnlyB = new Date(b.sortDate).toISOString().split('T')[0];
      
      // If dates are different, sort by date
      if (dateOnlyA !== dateOnlyB) {
        return new Date(dateOnlyA) - new Date(dateOnlyB);
      }
      
      // If dates are same, sort by createdAt time (ascending)
      // This ensures entries added later appear below earlier entries on the same date
      const createdAtA = allTransactions.find(t => t.id === a.id)?.createdAt;
      const createdAtB = allTransactions.find(t => t.id === b.id)?.createdAt;
      return new Date(createdAtA) - new Date(createdAtB);
    });

    // Calculate cumulative balance and assign Wire IDs using FIFO
    const balanceTracker = {}; // vendor-wise balance
    const wireBatches = {}; // Track OUT batches per vendor+wire for FIFO
    const wireIdStatusMap = {}; // Track if each Wire ID is fully returned or pending
    
    processedTransactions.forEach(trans => {
      const vendorKey = trans.vendor;
      const wireKey = `${trans.vendor}_${trans.wire}`;
      
      if (!balanceTracker[vendorKey]) {
        balanceTracker[vendorKey] = 0;
      }
      
      if (!wireBatches[wireKey]) {
        wireBatches[wireKey] = [];
      }
      
      if (trans.type === 'OUT') {
        // Generate unique Wire ID for OUT transaction
        const wireId = `S-${String(trans.srNo).padStart(6, '0')}`;
        trans.wireId = wireId;
        
        // Add to FIFO queue
        wireBatches[wireKey].push({
          wireId: wireId,
          remainingQty: trans.qtyOut,
          originalQty: trans.qtyOut
        });
        
        // Initially mark Wire ID as pending (not fully returned)
        wireIdStatusMap[wireId] = 'pending';
        
        balanceTracker[vendorKey] += trans.qtyOut;
      } else if (trans.type === 'IN') {
        // Reduce from oldest OUT batches first (FIFO)
        let inQtyRemaining = trans.qtyIn;
        const reducedBatches = [];
        
        for (let i = 0; i < wireBatches[wireKey].length && inQtyRemaining > 0; i++) {
          const batch = wireBatches[wireKey][i];
          
          if (batch.remainingQty > 0) {
            const deduction = Math.min(batch.remainingQty, inQtyRemaining);
            batch.remainingQty -= deduction;
            inQtyRemaining -= deduction;
            
            reducedBatches.push({
              wireId: batch.wireId,
              qty: deduction
            });
            
            // If Wire ID is fully returned, mark as completed
            if (batch.remainingQty === 0) {
              wireIdStatusMap[batch.wireId] = 'completed';
            }
          }
        }
        
        // Store which Wire IDs this IN transaction reduced
        trans.wireIdDetails = reducedBatches;
        trans.wireId = reducedBatches.map(b => b.wireId).join(', ');
        
        balanceTracker[vendorKey] -= trans.qtyIn;
      }
      
      trans.remainingWeight = balanceTracker[vendorKey];
    });
    
    // Apply Wire ID status to all transactions
    processedTransactions.forEach(trans => {
      if (trans.type === 'OUT' && trans.wireId) {
        // OUT transactions: check if Wire ID is completed or pending
        trans.wireIdStatus = wireIdStatusMap[trans.wireId] || 'pending';
      } else if (trans.type === 'IN' && trans.wireIdDetails) {
        // IN transactions: check if all reduced Wire IDs are completed
        const allCompleted = trans.wireIdDetails.every(detail => 
          wireIdStatusMap[detail.wireId] === 'completed'
        );
        trans.wireIdStatus = allCompleted ? 'completed' : 'partial';
      }
    });

    setTransactions(processedTransactions);
  };

  // Filter transactions and recalculate balance for filtered data
  const getFilteredTransactions = () => {
    let filtered = transactions;

    if (selectedVendor) {
      filtered = filtered.filter(t => t.vendor === selectedVendor);
    }

    if (wireFilter) {
      filtered = filtered.filter(t => 
        t.wire.toLowerCase().includes(wireFilter.toLowerCase())
      );
      
      // Recalculate balance for filtered wire only
      const balanceTracker = {};
      filtered = filtered.map(trans => {
        const vendorWireKey = `${trans.vendor}_${trans.wire}`;
        
        if (!balanceTracker[vendorWireKey]) {
          balanceTracker[vendorWireKey] = 0;
        }
        
        if (trans.type === 'OUT') {
          balanceTracker[vendorWireKey] += trans.qtyOut;
        } else if (trans.type === 'IN') {
          balanceTracker[vendorWireKey] -= trans.qtyIn;
        }
        
        return {
          ...trans,
          remainingWeight: balanceTracker[vendorWireKey]
        };
      });
    }

    return filtered;
  };

  // Pagination
  const filteredTransactions = getFilteredTransactions();
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Calculate previous page's ending balance (to show at top of current page)
  const previousPageBalance = currentPage > 1 ? (() => {
    const prevPageEndIndex = startIndex; // End of previous page is start of current page
    if (prevPageEndIndex > 0 && filteredTransactions[prevPageEndIndex - 1]) {
      return filteredTransactions[prevPageEndIndex - 1].remainingWeight;
    }
    return null;
  })() : null;

  // Calculate totals for current page
  const pageTotals = currentTransactions.reduce((acc, trans) => {
    if (!acc[trans.vendor]) {
      acc[trans.vendor] = {
        vendor: trans.vendor,
        totalLabourCharges: 0,
        finalRemainingWeight: 0,
        hasFiles: false
      };
    }
    acc[trans.vendor].totalLabourCharges += trans.labourCharges;
    // Keep the last remaining weight for this vendor on current page
    acc[trans.vendor].finalRemainingWeight = trans.remainingWeight;
    if (trans.pdfFile || trans.imgFile) {
      acc[trans.vendor].hasFiles = true;
    }
    return acc;
  }, {});

  // Handle file upload
  const handleFileUpload = async (index, fileType, event) => {
    const file = event.target.files[0];
    if (!file) return;

    const actualIndex = startIndex + index;
    const transaction = filteredTransactions[actualIndex];
    const key = `${actualIndex}-file`;

    try {
      setUploadingFiles(prev => ({ ...prev, [key]: true }));

      // Determine file type from extension
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');

      // In a real application, you would upload to a server
      // For now, we'll store the file name locally
      const reader = new FileReader();
      reader.onload = () => {
        setTransactions(prev => {
          const updated = [...prev];
          const transIndex = prev.findIndex(t => 
            t.vendor === transaction.vendor && t.wire === transaction.wire
          );
          if (transIndex !== -1) {
            if (isPdf) {
              updated[transIndex].pdfFile = file.name;
            } else if (isImage) {
              updated[transIndex].imgFile = file.name;
            }
          }
          return updated;
        });
      };
      reader.readAsDataURL(file);

      const fileTypeText = isPdf ? 'PDF' : isImage ? 'Image' : 'File';
      alert(`${fileTypeText} uploaded successfully!`);
    } catch (error) {
      alert('Failed to upload file: ' + error.message);
    } finally {
      setUploadingFiles(prev => ({ ...prev, [key]: false }));
    }
  };

  // Get unique wires for filter
  const uniqueWires = [...new Set(transactions.map(t => t.wire))];

  // Calculate wire summary with FIFO logic - track individual OUT batches
  const getWireSummary = () => {
    if (!selectedVendor) return [];

    const vendorTransactions = transactions.filter(t => t.vendor === selectedVendor);
    
    // Track individual OUT batches per wire (FIFO queue)
    const wireBatches = {}; // { wireName: [{ id, date, qty, remainingQty }, ...] }
    let batchCounter = 1; // Counter for unique Wire IDs

    vendorTransactions.forEach(trans => {
      const wireKey = trans.wire;
      
      if (!wireBatches[wireKey]) {
        wireBatches[wireKey] = [];
      }

      if (trans.type === 'OUT') {
        // Generate unique Wire ID using Sr.No from OUT panel
        const uniqueWireId = trans.srNo 
          ? `S-${String(trans.srNo).padStart(6, '0')}` 
          : `S-${String(batchCounter).padStart(6, '0')}`;
        
        // Add new OUT batch to queue
        wireBatches[wireKey].push({
          id: uniqueWireId,
          date: trans.date,
          sortDate: trans.sortDate,
          qty: trans.qtyOut,
          remainingQty: trans.qtyOut,
          wire: trans.wire,
          srNo: trans.srNo, // Store Sr.No for reference
          transactionId: trans.id // Store full transaction ID for reference
        });
        
        batchCounter++;
      } else if (trans.type === 'IN') {
        // Reduce from oldest OUT batches first (FIFO)
        let inQtyRemaining = trans.qtyIn;
        
        for (let i = 0; i < wireBatches[wireKey].length && inQtyRemaining > 0; i++) {
          const batch = wireBatches[wireKey][i];
          
          if (batch.remainingQty > 0) {
            const deduction = Math.min(batch.remainingQty, inQtyRemaining);
            batch.remainingQty -= deduction;
            inQtyRemaining -= deduction;
          }
        }
      }
    });

    // Flatten all batches and filter out fully consumed ones
    const summaryArray = [];
    
    Object.values(wireBatches).forEach(batches => {
      batches.forEach(batch => {
        if (batch.remainingQty > 0) {
          const outDate = new Date(batch.date);
          const today = new Date();
          const diffTime = Math.abs(today - outDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          summaryArray.push({
            wireId: batch.id,
            wire: batch.wire,
            outDate: batch.date,
            remainingQty: batch.remainingQty,
            days: diffDays
          });
        }
      });
    });

    // Sort by date (newest first - descending)
    return summaryArray.sort((a, b) => new Date(b.outDate) - new Date(a.outDate));
  };

  const wireSummary = getWireSummary();

  if (loading) {
    return (
      <div className="vendor-transaction-loading">
        <h2>🔄 Loading...</h2>
      </div>
    );
  }

  return (
    <div className="vendor-transaction-container">
      <div className="vendor-transaction-header">
        <h2>📋 Vendor Transaction Records</h2>
        
        <div className="vendor-transaction-controls">
          <button 
            className="screenshot-btn"
            onClick={handleScreenshot}
            title="Take Screenshot"
          >
            📸 Screenshot
          </button>
          <div className="vendor-select-wrapper">
            <label>Select Vendor:</label>
            <select 
              value={selectedVendor} 
              onChange={(e) => {
                setSelectedVendor(e.target.value);
                setCurrentPage(1);
              }}
              className="vendor-select"
            >
              <option value="">All Vendors</option>
              {vendors.map((vendor, idx) => (
                <option key={idx} value={vendor.name}>{vendor.name}</option>
              ))}
            </select>
          </div>

          <div className="vendor-select-wrapper">
            <label>Select Wire:</label>
            <select 
              value={wireFilter} 
              onChange={(e) => {
                setWireFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="vendor-select"
            >
              <option value="">All Wires</option>
              {uniqueWires.map((wire, idx) => (
                <option key={idx} value={wire}>{wire}</option>
              ))}
            </select>
          </div>

          {/* Clear History Button */}
          <button
            onClick={handleClearSpecificPage}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease',
              marginLeft: 'auto'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f57c00';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#ff9800';
              e.target.style.transform = 'translateY(0)';
            }}
            title="Clear print history for a specific page"
          >
            <span>🗑️</span>
            <span>Clear Page History</span>
          </button>
        </div>
      </div>

      {/* Toggle Button for Wire Summary - Positioned at top right */}
      {selectedVendor && wireSummary.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          marginBottom: '15px',
          position: 'relative',
          zIndex: 10
        }}>
          <button
            onClick={() => setShowWireSummary(!showWireSummary)}
            style={{
              padding: '10px 20px',
              backgroundColor: showWireSummary ? '#e74c3c' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
            }}
            title={showWireSummary ? 'Hide Wire Summary' : 'Show Wire Summary'}
          >
            <span>{showWireSummary ? '📊' : '📊'}</span>
            <span>{showWireSummary ? 'Hide Summary' : 'Show Summary'}</span>
            <span style={{ fontSize: '16px' }}>{showWireSummary ? '✕' : '→'}</span>
          </button>
        </div>
      )}

      {/* Main content with table and summary side by side */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        
        {/* Main Transaction Table */}
        <div className="vendor-transaction-table-wrapper" style={{ flex: 1 }}>
        
        {/* Previous Page Balance Display */}
        {previousPageBalance !== null && selectedVendor && (
          <div style={{
            backgroundColor: '#e8f5e9',
            border: '2px solid #4caf50',
            borderRadius: '8px',
            padding: '12px 20px',
            marginBottom: '15px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>📊</span>
              <span style={{ fontWeight: '600', color: '#2e7d32' }}>Previous Page Ending Balance:</span>
            </div>
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1b5e20',
              backgroundColor: '#c8e6c9',
              padding: '6px 16px',
              borderRadius: '6px'
            }}>
              {previousPageBalance.toFixed(3)} kg
            </div>
          </div>
        )}
        
        <table className="vendor-transaction-table">
          <thead>
            <tr>
              <th>Sr. No</th>
              <th>Date</th>
              <th>Wire Items</th>
              <th>Design</th>
              <th>Wire ID</th>
              <th>Labour Charges</th>
              <th>Qty. (Out)</th>
              <th>Qty. (In)</th>
              <th>Out/In</th>
              <th>Balance (OUT - IN)</th>
            </tr>
          </thead>
          <tbody>
            {currentTransactions.map((trans, index) => {
              // Determine background color - light red for pending Wire IDs (only when no wire filter)
              const getRowStyle = () => {
                if (!wireFilter && trans.type === 'OUT' && trans.wireIdStatus === 'pending') {
                  return { color: '#dc3545', fontWeight: '500' }; // Light red text color for pending
                }
                return {}; // Default
              };
              
              return (
                <tr key={index} style={getRowStyle()}>
                  <td>{startIndex + index + 1}</td>
                  <td>{new Date(trans.date).toLocaleDateString('en-GB')}</td>
                  <td>{trans.wire}</td>
                  <td>{trans.design}</td>
                  <td style={{ fontSize: '11px', fontWeight: '600' }}>
                    {trans.wireId || '-'}
                  </td>
                  <td className={trans.labourCharges > 0 ? 'highlight-yellow' : ''}>
                    {trans.labourCharges > 0 ? `₹${trans.labourCharges.toFixed(0)}` : ''}
                  </td>
                  <td>{trans.qtyOut > 0 ? trans.qtyOut.toFixed(3) : ''}</td>
                  <td>{trans.qtyIn > 0 ? trans.qtyIn.toFixed(3) : ''}</td>
                  <td>{trans.outIn === 'OUT' ? 'Out' : 'In'}</td>
                  <td>{trans.remainingWeight.toFixed(3)}</td>
                </tr>
              );
            })}

            {/* Summary rows for each vendor - Only show when specific vendor is selected and NO wire filter AND exactly 20 entries on page */}
            {selectedVendor && !wireFilter && currentTransactions.length === 20 && Object.values(pageTotals).map((vendorTotal, idx) => {
              // Check if THIS specific page was printed
              const pageKey = `${vendorTotal.vendor}-page-${currentPage}`;
              const isPagePrinted = printedPages.has(pageKey);
              return (
                <tr key={`summary-${idx}`} className={`vendor-summary-row ${isPagePrinted ? 'complete' : ''}`}>
                  <td colSpan="4" className="vendor-name-cell">
                    <strong>{vendorTotal.vendor}</strong>
                  </td>
                  <td>
                    <strong>Total Labour Charges</strong>
                  </td>
                  <td className="highlight-yellow">
                    <strong>₹{vendorTotal.totalLabourCharges.toFixed(0)}</strong>
                  </td>
                  <td colSpan="1"></td>
                  <td className="print-button-cell">
                    <button 
                      className="print-btn-summary"
                      onClick={handlePrint}
                      title="Print & Mark Complete"
                    >
                      🖨️ Print
                    </button>
                  </td>
                  <td className="status-cell">
                    {isPagePrinted ? (
                      <span className="status-done">✓ Done</span>
                    ) : (
                      <span className="status-pending">Pending</span>
                    )}
                  </td>
                  <td>
                    <strong>{vendorTotal.finalRemainingWeight.toFixed(3)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {/* End Main Transaction Table */}

        {/* Wire Summary Table - Right Side */}
        {selectedVendor && wireSummary.length > 0 && showWireSummary && (
          <div className="wire-summary-panel" style={{
            minWidth: '350px',
            maxWidth: '400px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            padding: '15px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{
              margin: '0 0 15px 0',
              fontSize: '16px',
              color: '#2c3e50',
              borderBottom: '2px solid #3498db',
              paddingBottom: '8px'
            }}>
              📊 Wire Summary - {selectedVendor}
            </h3>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table style={{
                width: '100%',
                fontSize: '12px',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#3498db', color: 'white' }}>
                    <th style={{ padding: '8px 4px', textAlign: 'left', fontSize: '11px' }}>Wire ID</th>
                    <th style={{ padding: '8px 4px', textAlign: 'left', fontSize: '11px' }}>Date</th>
                    <th style={{ padding: '8px 4px', textAlign: 'left', fontSize: '11px' }}>Wire</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', fontSize: '11px' }}>Qty</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', fontSize: '11px' }}>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {wireSummary.map((item, idx) => (
                    <tr key={idx} style={{
                      backgroundColor: idx % 2 === 0 ? 'white' : '#f8f9fa',
                      borderBottom: '1px solid #dee2e6'
                    }}>
                      <td style={{ padding: '6px 4px', fontSize: '11px', fontWeight: '600' }}>
                        {item.wireId}
                      </td>
                      <td style={{ padding: '6px 4px', fontSize: '10px' }}>
                        {new Date(item.outDate).toLocaleDateString('en-GB')}
                      </td>
                      <td style={{ padding: '6px 4px', fontSize: '11px' }}>
                        {item.wire}
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: '600', color: '#e74c3c' }}>
                        {item.remainingQty.toFixed(3)}
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: '600', color: item.days > 30 ? '#e74c3c' : '#27ae60' }}>
                        {item.days}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* End Wire Summary Table */}

      </div>
      {/* End flex container */}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            ← Previous
          </button>
          
          <span className="pagination-info">
            Page {currentPage} of {totalPages} ({filteredTransactions.length} entries)
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default VendorTransactionTable;
