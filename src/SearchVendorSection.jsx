import { useState, useEffect } from 'react';
import apiService from './services/api';

const SearchVendorSection = ({ inItems, outItems }) => {
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [vendorData, setVendorData] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionsPerPage] = useState(20);
  const [allTransactions, setAllTransactions] = useState([]);

  useEffect(() => {
    loadVendors();
    
    // Check if a vendor was pre-selected from VendorManagement
    const preSelectedVendor = sessionStorage.getItem('selectedVendor');
    if (preSelectedVendor) {
      setVendorSearch(preSelectedVendor);
      setSelectedVendor(preSelectedVendor);
      loadVendorData(preSelectedVendor);
      // Clear the session storage after using it
      sessionStorage.removeItem('selectedVendor');
    }
  }, []);

  const loadVendors = async () => {
    try {
      const vendorsData = await apiService.getAllVendors();
      setVendors(vendorsData);
    } catch (error) {
    }
  };

  // Get unique vendors from transactions
  const uniqueVendors = [...new Set([...inItems, ...outItems].map(item => item.vendor))];
  
  // Filter vendors based on search
  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const handleVendorSelect = (vendorName) => {
    setSelectedVendor(vendorName);
    setVendorSearch(vendorName);
    setShowDropdown(false);
    loadVendorData(vendorName);
  };

  const loadVendorData = (vendorName) => {
    // Get all transactions for this vendor
    const vendorTransactions = [...inItems, ...outItems]
      .filter(item => item.vendor === vendorName)
      .sort((a, b) => {
        // Sort by transaction date first, then by createdAt time for same-date entries
        const transDateA = a.inDate || a.outDate || a.createdAt || a.timestamp;
        const transDateB = b.inDate || b.outDate || b.createdAt || b.timestamp;
        
        const dateOnlyA = new Date(transDateA).toISOString().split('T')[0];
        const dateOnlyB = new Date(transDateB).toISOString().split('T')[0];
        
        // If dates are different, sort by date
        if (dateOnlyA !== dateOnlyB) {
          return new Date(dateOnlyA) - new Date(dateOnlyB);
        }
        
        // If dates are same, sort by createdAt time (ascending)
        return new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp);
      });

    // Store all transactions for pagination
    setAllTransactions(vendorTransactions);
    setCurrentPage(1); // Reset to first page when vendor changes
    
    // Group by wire and calculate progressive remaining weight
    const wireData = {};
    
    vendorTransactions.forEach(transaction => {
      const wire = transaction.item;
      if (!wireData[wire]) {
        wireData[wire] = {
          wire,
          transactions: [],
          totalOut: 0,
          totalIn: 0
        };
      }
      wireData[wire].transactions.push(transaction);
      
      // Calculate totals for each wire
      if (transaction.type === 'OUT') {
        wireData[wire].totalOut += transaction.qty || 0;
      } else {
        wireData[wire].totalIn += transaction.qty || 0;
      }
    });

    // Calculate progressive remaining weight for each wire and sort transactions
    Object.values(wireData).forEach(wire => {
      // Sort transactions by date (oldest first) to calculate progressive remaining
      const sortedTransactions = wire.transactions.sort((a, b) => 
        new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp)
      );
      
      let currentRemaining = 0;
      
      sortedTransactions.forEach(transaction => {
        if (transaction.type === 'OUT') {
          currentRemaining += transaction.qty || 0;
        } else if (transaction.type === 'IN') {
        }
        
        transaction.remainingWeight = currentRemaining;
      });

      // Sort transactions: Latest entry last (at bottom of table)
      wire.transactions.sort((a, b) => {
        // Get the most recent date from available date fields
        const getLatestDate = (transaction) => {
          const dates = [
            transaction.createdAt,
            transaction.timestamp,
            transaction.date,
            transaction.outDate,
            transaction.inDate
          ].filter(Boolean); // Remove null/undefined values
          
          if (dates.length === 0) return new Date(0); // Fallback to epoch if no dates
          
          // Return the most recent date
          return new Date(Math.max(...dates.map(d => new Date(d).getTime())));
        };
        
        const dateA = getLatestDate(a);
        const dateB = getLatestDate(b);
        
        // Sort by oldest date first (oldest to newest) - latest will be at bottom
        return dateA - dateB;
      });

      // Calculate final remaining weight for this wire
      wire.finalRemaining = wire.totalOut - wire.totalIn;
    });

    setVendorData(wireData);
  };

  // Pagination logic
  const totalTransactions = allTransactions.length;
  const totalPages = Math.ceil(totalTransactions / transactionsPerPage);
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const currentTransactions = allTransactions.slice(startIndex, endIndex);

  // Get paginated vendor data
  const getPaginatedVendorData = () => {
    const wireData = {};
    
    currentTransactions.forEach(transaction => {
      const wire = transaction.item;
      if (!wireData[wire]) {
        wireData[wire] = {
          wire,
          transactions: [],
          totalOut: 0,
          totalIn: 0
        };
      }
      wireData[wire].transactions.push(transaction);
      
      // Calculate totals for current page
      if (transaction.type === 'OUT') {
        wireData[wire].totalOut += transaction.qty || 0;
      } else {
        wireData[wire].totalIn += transaction.qty || 0;
      }
    });

    // Calculate progressive remaining weight and sort for current page
    Object.values(wireData).forEach(wire => {
      // Sort transactions by date (oldest first) to calculate progressive remaining
      const sortedTransactions = wire.transactions.sort((a, b) => 
        new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp)
      );
      
      let currentRemaining = 0;
      
      sortedTransactions.forEach(transaction => {
        if (transaction.type === 'OUT') {
          currentRemaining += transaction.qty || 0;
        } else if (transaction.type === 'IN') {
          currentRemaining -= transaction.qty || 0;
        }
        
        transaction.remainingWeight = currentRemaining;
      });

      // Sort transactions: Latest entry last (at bottom of table)
      wire.transactions.sort((a, b) => {
        const getLatestDate = (transaction) => {
          const dates = [
            transaction.createdAt,
            transaction.timestamp,
            transaction.date,
            transaction.outDate,
            transaction.inDate
          ].filter(Boolean);
          
          if (dates.length === 0) return new Date(0);
          return new Date(Math.max(...dates.map(d => new Date(d).getTime())));
        };
        
        const dateA = getLatestDate(a);
        const dateB = getLatestDate(b);
        return dateA - dateB;
      });

      // Calculate final remaining weight for this wire
      wire.finalRemaining = wire.totalOut - wire.totalIn;
    });

    return wireData;
  };

  const paginatedVendorData = getPaginatedVendorData();

  // Pagination controls
  const goToPage = (page) => {
    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Download current page CSV function
  const downloadCurrentPageExcel = () => {
    if (!selectedVendor) {
      alert('Select vendor first!');
      return;
    }
    
    const rows = [];
    
    // Add main header
    rows.push([`Vendor: ${selectedVendor} - Page ${currentPage} Transaction Report`]);
    rows.push([`Export Date: ${new Date().toLocaleDateString('en-GB')}`]);
    rows.push([`Page: ${currentPage} of ${totalPages} | Showing ${currentTransactions.length} of ${totalTransactions} transactions`]);
    rows.push(['']); // Empty row for spacing
    
    // Process each wire separately for current page
    Object.values(paginatedVendorData).forEach((wire, wireIndex) => {
      // Wire header section
      rows.push([`WIRE: ${wire.wire}`]);
      rows.push([`Page OUT: ${wire.totalOut.toFixed(2)} kg`, `Page IN: ${wire.totalIn.toFixed(2)} kg`, `Page Remaining: ${wire.finalRemaining.toFixed(2)} kg`]);
      rows.push([`Page Transactions: ${wire.transactions.length}`]);
      rows.push(['']); // Empty row
      
      // Column headers for this wire
      rows.push(['Date', 'Type', 'OUT Weight (kg)', 'IN Weight (kg)', 'Payal Design', 'Payable Price (₹)', 'OUT Date', 'IN Date', 'Remaining Weight (kg)']);
      
      // Transaction data for this wire
      wire.transactions.forEach((item) => {
        const formatDate = (dateValue) => {
          if (!dateValue) return '';
          try {
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB');
          } catch (e) {
            return '';
          }
        };

        let transactionDate = 'N/A';
        if (item.createdAt) {
          transactionDate = formatDate(item.createdAt) || 'N/A';
        } else if (item.timestamp) {
          transactionDate = formatDate(item.timestamp) || 'N/A';
        } else if (item.date) {
          transactionDate = formatDate(item.date) || 'N/A';
        }

        let outDate = '';
        if (item.type === 'OUT') {
          if (item.outDate) {
            outDate = formatDate(item.outDate);
          } else if (item.createdAt) {
            outDate = formatDate(item.createdAt);
          } else if (item.timestamp) {
            outDate = formatDate(item.timestamp);
          }
        }

        let inDate = '';
        if (item.type === 'IN') {
          if (item.inDate) {
            inDate = formatDate(item.inDate);
          } else if (item.createdAt) {
            inDate = formatDate(item.createdAt);
          } else if (item.timestamp) {
            inDate = formatDate(item.timestamp);
          }
        }

        const outWeight = item.type === 'OUT' ? item.qty.toFixed(2) : '';
        const inWeight = item.type === 'IN' ? item.qty.toFixed(2) : '';
        
        rows.push([
          transactionDate,
          item.type,
          outWeight,
          inWeight,
          item.payalType || 'N/A',
          item.price ? item.price.toFixed(2) : '',
          outDate,
          inDate,
          item.remainingWeight ? item.remainingWeight.toFixed(2) : '0.00'
        ]);
      });
      
      // Add spacing between wires (except for last wire)
      if (wireIndex < Object.keys(paginatedVendorData).length - 1) {
        rows.push(['']); // Empty row
        rows.push(['='.repeat(50)]); // Separator
        rows.push(['']); // Empty row
      }
    });
    
    // Add summary at the end
    rows.push(['']);
    rows.push(['PAGE SUMMARY']);
    rows.push([`Page Transactions: ${currentTransactions.length}`]);
    rows.push([`Total Transactions: ${totalTransactions}`]);
    rows.push([`Page: ${currentPage} of ${totalPages}`]);
    
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedVendor}_Page_${currentPage}_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download CSV function - organized by wire (all data)
  const downloadExcel = () => {
    if (!selectedVendor) {
      alert('Select vendor first!');
      return;
    }
    
    const rows = [];
    
    // Add main header
    rows.push([`Vendor: ${selectedVendor} - Complete Transaction Report`]);
    rows.push([`Export Date: ${new Date().toLocaleDateString('en-GB')}`]);
    rows.push([`Total Wire Types: ${Object.keys(vendorData).length}`]);
    rows.push(['']); // Empty row for spacing
    
    // Process each wire separately
    Object.values(vendorData).forEach((wire, wireIndex) => {
      // Wire header section
      rows.push([`WIRE: ${wire.wire}`]);
      rows.push([`Total OUT: ${wire.totalOut.toFixed(2)} kg`, `Total IN: ${wire.totalIn.toFixed(2)} kg`, `Final Remaining: ${wire.finalRemaining.toFixed(2)} kg`]);
      rows.push([`Transactions: ${wire.transactions.length}`]);
      rows.push(['']); // Empty row
      
      // Column headers for this wire
      rows.push(['Date', 'Type', 'OUT Weight (kg)', 'IN Weight (kg)', 'Payal Design', 'Payable Price (₹)', 'OUT Date', 'IN Date', 'Remaining Weight (kg)']);
      
      // Transaction data for this wire
      wire.transactions.forEach((item) => {
        // Handle multiple possible date field names and formats
        const formatDate = (dateValue) => {
          if (!dateValue) return '';
          try {
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB');
          } catch (e) {
            return '';
          }
        };

        let transactionDate = 'N/A';
        if (item.createdAt) {
          transactionDate = formatDate(item.createdAt) || 'N/A';
        } else if (item.timestamp) {
          transactionDate = formatDate(item.timestamp) || 'N/A';
        } else if (item.date) {
          transactionDate = formatDate(item.date) || 'N/A';
        }

        let outDate = '';
        if (item.type === 'OUT') {
          if (item.outDate) {
            outDate = formatDate(item.outDate);
          } else if (item.createdAt) {
            outDate = formatDate(item.createdAt);
          } else if (item.timestamp) {
            outDate = formatDate(item.timestamp);
          }
        }

        let inDate = '';
        if (item.type === 'IN') {
          if (item.inDate) {
            inDate = formatDate(item.inDate);
          } else if (item.createdAt) {
            inDate = formatDate(item.createdAt);
          } else if (item.timestamp) {
            inDate = formatDate(item.timestamp);
          }
        }

        const outWeight = item.type === 'OUT' ? item.qty.toFixed(2) : '';
        const inWeight = item.type === 'IN' ? item.qty.toFixed(2) : '';
        
        rows.push([
          transactionDate,
          item.type,
          outWeight,
          inWeight,
          item.payalType || 'N/A',
          item.price ? item.price.toFixed(2) : '',
          outDate,
          inDate,
          item.remainingWeight.toFixed(2)
        ]);
      });
      
      // Add spacing between wires (except for last wire)
      if (wireIndex < Object.keys(vendorData).length - 1) {
        rows.push(['']); // Empty row
        rows.push(['='.repeat(50)]); // Separator
        rows.push(['']); // Empty row
      }
    });
    
    // Add summary at the end
    rows.push(['']);
    rows.push(['SUMMARY']);
    rows.push([`Total Transactions: ${Object.values(vendorData).reduce((sum, wire) => sum + wire.transactions.length, 0)}`]);
    rows.push([`Total Wire Types: ${Object.keys(vendorData).length}`]);
    
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedVendor}_Wire_Organized_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download individual wire data
  const downloadWireData = (wireName) => {
    if (!selectedVendor) {
      alert('Select vendor first!');
      return;
    }
    
    const wire = Object.values(vendorData).find(w => w.wire === wireName);
    if (!wire || wire.transactions.length === 0) {
      alert(`No transaction data found for ${wireName}`);
      return;
    }
    
    const rows = [];
    
    // Wire-specific header
    rows.push([`Vendor: ${selectedVendor} - ${wireName} Wire Report`]);
    rows.push([`Export Date: ${new Date().toLocaleDateString('en-GB')}`]);
    rows.push([`Total OUT: ${wire.totalOut.toFixed(2)} kg`, `Total IN: ${wire.totalIn.toFixed(2)} kg`, `Final Remaining: ${wire.finalRemaining.toFixed(2)} kg`]);
    rows.push([`Total Transactions: ${wire.transactions.length}`]);
    rows.push(['']); // Empty row
    
    // Column headers
    rows.push(['Date', 'Type', 'OUT Weight (kg)', 'IN Weight (kg)', 'Payal Design', 'Payable Price (₹)', 'OUT Date', 'IN Date', 'Remaining Weight (kg)']);
    
    // Transaction data
    wire.transactions.forEach((item) => {
      // Handle multiple possible date field names and formats
      const formatDate = (dateValue) => {
        if (!dateValue) return '';
        try {
          const date = new Date(dateValue);
          return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB');
        } catch (e) {
          return '';
        }
      };

      let transactionDate = 'N/A';
      if (item.createdAt) {
        transactionDate = formatDate(item.createdAt) || 'N/A';
      } else if (item.timestamp) {
        transactionDate = formatDate(item.timestamp) || 'N/A';
      } else if (item.date) {
        transactionDate = formatDate(item.date) || 'N/A';
      }

      let outDate = '';
      if (item.type === 'OUT') {
        if (item.outDate) {
          outDate = formatDate(item.outDate);
        } else if (item.createdAt) {
          outDate = formatDate(item.createdAt);
        } else if (item.timestamp) {
          outDate = formatDate(item.timestamp);
        }
      }

      let inDate = '';
      if (item.type === 'IN') {
        if (item.inDate) {
          inDate = formatDate(item.inDate);
        } else if (item.createdAt) {
          inDate = formatDate(item.createdAt);
        } else if (item.timestamp) {
          inDate = formatDate(item.timestamp);
        }
      }

      const outWeight = item.type === 'OUT' ? item.qty.toFixed(2) : '';
      const inWeight = item.type === 'IN' ? item.qty.toFixed(2) : '';
      
      rows.push([
        transactionDate,
        item.type,
        outWeight,
        inWeight,
        item.payalType || 'N/A',
        item.price ? item.price.toFixed(2) : '',
        outDate,
        inDate,
        item.remainingWeight.toFixed(2)
      ]);
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedVendor}_${wireName}_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="searchSection" className="panel">
      <h2 style={{color: '#e67e22'}}>🔍 Search Vendor</h2>
      <p style={{color: '#666', marginBottom: '20px'}}>Search or select a vendor to view detailed transaction history</p>
      
      <div style={{marginBottom: '30px', position: 'relative'}}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input 
              type="text" 
              value={vendorSearch} 
              onChange={(e) => {
                setVendorSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="🔍 Type vendor name or select from dropdown..." 
              style={{
                width: '100%',
                padding: '12px 15px',
                fontSize: '15px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                outline: 'none'
              }}
            />
            
            {/* Dropdown */}
            {showDropdown && filteredVendors.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '2px solid #e67e22',
                borderRadius: '8px',
                marginTop: '5px',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                {filteredVendors.map((vendor, index) => (
                  <div
                    key={vendor._id || index}
                    onClick={() => handleVendorSelect(vendor.name)}
                    style={{
                      padding: '12px 15px',
                      cursor: 'pointer',
                      borderBottom: index < filteredVendors.length - 1 ? '1px solid #eee' : 'none',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#fff3e0'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                  >
                    <strong>{vendor.name}</strong>
                    {vendor.phone && <span style={{ marginLeft: '10px', color: '#666', fontSize: '13px' }}>📱 {vendor.phone}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <button 
            onClick={downloadExcel}
            disabled={!selectedVendor}
            style={{
              padding: '12px 20px',
              backgroundColor: selectedVendor ? '#27ae60' : '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: selectedVendor ? 'pointer' : 'not-allowed',
              fontSize: '15px',
              fontWeight: '600'
            }}
          >
            📥 Download All Wires Report
          </button>
        </div>
      </div>

      {selectedVendor && Object.keys(paginatedVendorData).length > 0 && (
        <>
          <div style={{
            backgroundColor: '#fff3e0',
            padding: '20px',
            borderRadius: '10px',
            marginBottom: '20px',
            border: '2px solid #e67e22'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#e67e22' }}>
              📊 Vendor: {selectedVendor}
            </h3>
            <p style={{ margin: '0 0 10px 0', color: '#666' }}>
              Total Transactions: <strong>{totalTransactions}</strong> | 
              Showing: <strong>{currentTransactions.length}</strong> transactions (Page {currentPage} of {totalPages})
            </p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                onClick={downloadCurrentPageExcel}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                📥 Download Current Page
              </button>
              <span style={{ color: '#666', fontSize: '14px' }}>|
              </span>
              <button 
                onClick={downloadExcel}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                📥 Download All Data
              </button>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  backgroundColor: currentPage === 1 ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                ← Previous
              </button>
              
              <div style={{ display: 'flex', gap: '5px' }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: page === currentPage ? '#007bff' : '#ffffff',
                      color: page === currentPage ? 'white' : '#007bff',
                      border: '1px solid #007bff',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: page === currentPage ? 'bold' : 'normal'
                    }}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 12px',
                  backgroundColor: currentPage === totalPages ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                Next →
              </button>
              
              <span style={{ marginLeft: '15px', color: '#666', fontSize: '14px' }}>
                Page {currentPage} of {totalPages} ({totalTransactions} total transactions)
              </span>
            </div>
          )}

          {Object.values(paginatedVendorData).map((wire, wireIndex) => (
            <div key={wireIndex} style={{ marginBottom: '30px' }}>
              {/* Wire Header */}
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '15px 20px',
                borderRadius: '8px 8px 0 0',
                border: '2px solid #dee2e6',
                borderBottom: '1px solid #dee2e6'
              }}>
                <h4 style={{ 
                  margin: '0 0 8px 0', 
                  color: '#495057',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>🔧 Wire: <strong>{wire.wire}</strong></span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                      onClick={() => downloadWireData(wire.wire)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      📥 Download Wire
                    </button>
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: 'normal',
                      color: wire.finalRemaining >= 0 ? '#27ae60' : '#e74c3c'
                    }}>
                      Final Remaining: <strong>{wire.finalRemaining.toFixed(2)} kg</strong>
                    </span>
                  </div>
                </h4>
                <div style={{ fontSize: '13px', color: '#6c757d' }}>
                  Total OUT: <strong style={{color: '#e74c3c'}}>{wire.totalOut.toFixed(2)} kg</strong> | 
                  Total IN: <strong style={{color: '#27ae60'}}>{wire.totalIn.toFixed(2)} kg</strong> | 
                  Transactions: <strong>{wire.transactions.length}</strong>
                </div>
              </div>

              {/* Wire Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  minWidth: '1200px',
                  border: '2px solid #dee2e6',
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e9ecef' }}>
                      <th>Type</th>
                      <th>Vendor</th>
                      <th>OUT Weight (kg)</th>
                      <th>IN Weight (kg)</th>
                      <th>Payal Design</th>
                      <th>Payable Price (₹)</th>
                      <th>OUT Date</th>
                      <th>IN Date</th>
                      <th>Remaining Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wire.transactions.map((item, i) => (
                      <tr key={i}>
                        <td>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: item.type === 'OUT' ? '#fee' : '#efe',
                            color: item.type === 'OUT' ? '#c00' : '#0a0',
                            fontWeight: 'bold',
                            fontSize: '12px'
                          }}>
                            {item.type}
                          </span>
                        </td>
                        <td>{item.vendor}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#e74c3c' }}>
                          {item.type === 'OUT' ? item.qty.toFixed(2) : '-'}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#27ae60' }}>
                          {item.type === 'IN' ? item.qty.toFixed(2) : '-'}
                        </td>
                        <td>
                          {item.payalType ? (
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#e8f5e9',
                              color: '#2e7d32',
                              fontSize: '12px'
                            }}>
                              {item.payalType}
                            </span>
                          ) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {item.type === 'IN' && item.price ? `₹${item.price.toFixed(2)}` : '-'}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '12px' }}>
                          {item.type === 'OUT' && item.outDate ? new Date(item.outDate).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '12px' }}>
                          {item.type === 'IN' && item.inDate ? new Date(item.inDate).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td style={{ 
                          textAlign: 'center', 
                          fontWeight: 'bold',
                          color: item.remainingWeight >= 0 ? '#27ae60' : '#e74c3c'
                        }}>
                          {item.remainingWeight.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {selectedVendor && Object.keys(paginatedVendorData).length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: '10px',
          color: '#666'
        }}>
          <p style={{ fontSize: '18px', margin: 0 }}>No transactions found for this vendor.</p>
        </div>
      )}
    </div>
  );
};

export default SearchVendorSection;
