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
        
        console.log(`Page ${currentPage} marked as printed for ${selectedVendor}`);
      } catch (error) {
        console.error('Error marking page as printed:', error);
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
      console.error('Error taking screenshot:', error);
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
        console.error('Error clearing print history:', error);
        alert('Failed to clear print history: ' + error.message);
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
      console.error('Error loading print statuses:', error);
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
      console.error('Error loading data:', error);
      alert('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const processTransactions = (allTransactions) => {
    console.log('Raw transactions before processing:', allTransactions.slice(0, 5));
    
    // Create individual rows for each transaction with Sr.No
    const processedTransactions = allTransactions.map((trans, index) => {
      // Use createdAt for sorting (actual creation time), but display inDate/outDate
      const displayDate = trans.inDate || trans.outDate || trans.createdAt;
      const sortDate = trans.createdAt; // Use createdAt for proper chronological order
      
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
        date: displayDate, // For display
        sortDate: sortDate, // For sorting
        type: trans.type,
        wireId: '', // Will be assigned based on FIFO
        wireIdDetails: [], // For IN transactions, track which Wire IDs were reduced
        pdfFile: null,
        imgFile: null
      };
    });

    // Sort by createdAt - ASCENDING ORDER (oldest at top, newest at bottom)
    // Pure chronological order - jo pehle add hua wo pehle dikhega
    processedTransactions.sort((a, b) => {
      const dateA = new Date(a.sortDate).getTime();
      const dateB = new Date(b.sortDate).getTime();
      
      // Sort by createdAt: oldest first (ascending)
      return dateA - dateB; // Simple chronological order
    });
    
    console.log('Sorted transactions (first 10):', processedTransactions.slice(0, 10).map(t => ({
      createdAt: new Date(t.sortDate).toLocaleString('en-IN'),
      displayDate: new Date(t.date).toLocaleString('en-IN'),
      type: t.type,
      vendor: t.vendor,
      wire: t.wire,
      qty: t.type === 'OUT' ? t.qtyOut : t.qtyIn
    })));

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
      console.error('Error uploading file:', error);
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
            className="clear-history-btn"
            onClick={handleClearPrintHistory}
            title="Clear Print History"
          >
            🗑️ Clear History
          </button>
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
        </div>
      </div>

      {/* Main content with table and summary side by side */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        
        {/* Main Transaction Table */}
        <div className="vendor-transaction-table-wrapper" style={{ flex: 1 }}>
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
                  return { backgroundColor: '#f8d7da' }; // Light red background for pending
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
                  <td>{trans.qtyOut > 0 ? trans.qtyOut.toFixed(0) : ''}</td>
                  <td>{trans.qtyIn > 0 ? trans.qtyIn.toFixed(0) : ''}</td>
                  <td>{trans.outIn === 'OUT' ? 'Out' : 'In'}</td>
                  <td>{trans.remainingWeight.toFixed(0)}</td>
                </tr>
              );
            })}

            {/* Summary rows for each vendor - Only show when specific vendor is selected and NO wire filter */}
            {selectedVendor && !wireFilter && Object.values(pageTotals).map((vendorTotal, idx) => {
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
                    <strong>{vendorTotal.finalRemainingWeight.toFixed(0)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {/* End Main Transaction Table */}

        {/* Wire Summary Table - Right Side */}
        {selectedVendor && wireSummary.length > 0 && (
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
                        {item.remainingQty.toFixed(0)}
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
