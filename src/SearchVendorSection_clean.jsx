import { useState, useEffect } from 'react';
import apiService from './services/api';

const SearchVendorSection = ({ inItems, outItems }) => {
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [vendorData, setVendorData] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const vendorsData = await apiService.getAllVendors();
      setVendors(vendorsData);
    } catch (error) {
      // Error loading vendors
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
      .sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp));

    // Group by wire and calculate remaining weight
    const wireData = {};
    
    vendorTransactions.forEach(transaction => {
      const wire = transaction.item;
      if (!wireData[wire]) {
        wireData[wire] = {
          wire,
          outWeight: 0,
          inWeight: 0,
          transactions: []
        };
      }
      
      if (transaction.type === 'OUT') {
        wireData[wire].outWeight += transaction.qty || 0;
      } else {
        wireData[wire].inWeight += transaction.qty || 0;
      }
      
      wireData[wire].transactions.push(transaction);
    });

    // Flatten to show all transactions with calculated remaining weight
    const data = [];
    Object.values(wireData).forEach(wire => {
      wire.transactions.forEach(transaction => {
        data.push({
          ...transaction,
          remainingWeight: wire.outWeight - wire.inWeight
        });
      });
    });

    setVendorData(data);
  };

  // Download CSV function
  const downloadExcel = () => {
    if (!selectedVendor) {
      alert('Select vendor first!');
      return;
    }
    
    const rows = [['Date', 'Type', 'Vendor', 'Wire', 'OUT Weight', 'IN Weight', 'Payal Design', 'Payable Price', 'Remaining Weight']];
    vendorData.forEach((item) => {
      const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB') : 'N/A';
      const outWeight = item.type === 'OUT' ? item.qty : '';
      const inWeight = item.type === 'IN' ? item.qty : '';
      rows.push([
        date,
        item.type,
        item.vendor,
        item.item,
        outWeight,
        inWeight,
        item.payalType || 'N/A',
        item.price || 0,
        item.remainingWeight.toFixed(2)
      ]);
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedVendor}_Vendor_Data.csv`);
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
            📥 Download CSV
          </button>
        </div>
      </div>

      {selectedVendor && vendorData.length > 0 && (
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
            <p style={{ margin: 0, color: '#666' }}>
              Total Transactions: <strong>{vendorData.length}</strong>
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '1000px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Vendor</th>
                  <th>Wire</th>
                  <th>OUT Weight (kg)</th>
                  <th>IN Weight (kg)</th>
                  <th>Payal Design</th>
                  <th>Payable Price (₹)</th>
                  <th>Remaining Weight (kg)</th>
                </tr>
              </thead>
              <tbody>
                {vendorData.map((item, i) => (
                  <tr key={i}>
                    <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB') : 'N/A'}</td>
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
                    <td><strong>{item.item}</strong></td>
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
        </>
      )}

      {selectedVendor && vendorData.length === 0 && (
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
