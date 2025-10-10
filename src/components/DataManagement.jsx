import { useState, useEffect } from 'react';
import apiService from '../services/api';

const DataManagement = ({ onDataUpdate }) => {
  const [newWire, setNewWire] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Price chart for payal types
  const [priceChart, setPriceChart] = useState({});
  const [allWires, setAllWires] = useState([]);
  
  const [editingWire, setEditingWire] = useState(null);
  const [editPrices, setEditPrices] = useState({});
  
  // For adding new payal to a wire
  const [addingPayalFor, setAddingPayalFor] = useState(null);
  const [newPayalName, setNewPayalName] = useState('');
  const [newPayalPrice, setNewPayalPrice] = useState('');

  // Load wires and price chart from database
  useEffect(() => {
    loadWiresAndPrices();
  }, []);

  const loadWiresAndPrices = async () => {
    try {
      setLoading(true);
      // Load both items and price chart from database
      const [itemsData, priceChartData] = await Promise.all([
        apiService.getAllItems(),
        apiService.getPayalPriceChart()
      ]);
      
      setAllWires(itemsData.map(item => item.name));
      setPriceChart(priceChartData);
    } catch (error) {
      setMessage(`❌ Error loading data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addWire = async () => {
    if (!newWire.trim()) {
      setMessage('⚠️ Please enter a wire name');
      return;
    }

    try {
      setLoading(true);
      await apiService.addItem(newWire.trim());
      
      setNewWire('');
      setMessage(`✅ Wire "${newWire}" added successfully. Now add payal types and prices.`);
      
      // Reload price chart to reflect changes
      await loadWiresAndPrices();
      
      if (onDataUpdate) onDataUpdate();
    } catch (error) {
      setMessage(`❌ Error adding wire: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (wireName) => {
    setEditingWire(wireName);
    setEditPrices({ ...(priceChart[wireName] || {}) });
  };

  const cancelEdit = () => {
    setEditingWire(null);
    setEditPrices({});
  };

  const saveEdit = async () => {
    try {
      setLoading(true);
      
      // Update each payal price in the database
      for (const [payalType, price] of Object.entries(editPrices)) {
        await apiService.updatePayalPrice(editingWire, payalType, price);
      }
      
      setMessage(`✅ Prices updated for ${editingWire}`);
      setEditingWire(null);
      setEditPrices({});
      
      // Reload price chart to reflect changes
      await loadWiresAndPrices();
    } catch (error) {
      setMessage(`❌ Error updating prices: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (payalType, value) => {
    setEditPrices(prev => ({
      ...prev,
      [payalType]: parseFloat(value) || 0
    }));
  };

  const startAddingPayal = (wireName) => {
    setAddingPayalFor(wireName);
    setNewPayalName('');
    setNewPayalPrice('');
  };

  const cancelAddPayal = () => {
    setAddingPayalFor(null);
    setNewPayalName('');
    setNewPayalPrice('');
  };

  const addPayalToWire = async () => {
    if (!newPayalName.trim()) {
      setMessage('⚠️ Please enter payal name');
      return;
    }
    if (!newPayalPrice || parseFloat(newPayalPrice) < 0) {
      setMessage('⚠️ Please enter valid price');
      return;
    }

    try {
      setLoading(true);
      await apiService.addPayalPrice(addingPayalFor, newPayalName.trim(), parseFloat(newPayalPrice));
      
      setMessage(`✅ ${newPayalName} payal added to ${addingPayalFor}`);
      cancelAddPayal();
      
      // Reload price chart to reflect changes
      await loadWiresAndPrices();
    } catch (error) {
      setMessage(`❌ Error adding payal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deletePayal = async (wireName, payalName) => {
    if (window.confirm(`Delete ${payalName} payal from ${wireName}?`)) {
      try {
        setLoading(true);
        await apiService.deletePayalPrice(wireName, payalName);
        
        setMessage(`✅ ${payalName} payal deleted from ${wireName}`);
        
        // Reload price chart to reflect changes
        await loadWiresAndPrices();
      } catch (error) {
        setMessage(`❌ Error deleting payal: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const deleteWire = async (wireName) => {
    const hasPayalPrices = priceChart[wireName] && Object.keys(priceChart[wireName]).length > 0;
    
    const confirmMessage = hasPayalPrices 
      ? `Delete entire wire "${wireName}" and all its payal prices?`
      : `Delete wire "${wireName}"? (This wire has no payal prices yet)`;
    
    if (window.confirm(confirmMessage)) {
      try {
        setLoading(true);
        
        // Try to delete from price chart if the wire has payal prices
        if (hasPayalPrices) {
          try {
            await apiService.deleteWireFromPriceChart(wireName);
          } catch (priceChartError) {
            // If wire doesn't exist in price chart, that's okay - continue with item deletion
          }
        }
        
        // Delete from items database
        try {
          await apiService.deleteItem(wireName);
        } catch (itemError) {
          // Continue anyway - the wire might not exist in items database
        }
        
        setMessage(`✅ Wire "${wireName}" deleted successfully`);
        
        // Reload data to reflect changes
        await loadWiresAndPrices();
        
        if (onDataUpdate) onDataUpdate();
      } catch (error) {
        setMessage(`❌ Error deleting wire: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const seedPriceChart = async () => {
    if (window.confirm('This will reset all payal price chart data to default values. Continue?')) {
      try {
        setLoading(true);
        await apiService.seedPayalPriceChart();
        
        setMessage('✅ Payal price chart seeded successfully with default data!');
        
        // Reload price chart to reflect changes
        await loadWiresAndPrices();
        
        if (onDataUpdate) onDataUpdate();
      } catch (error) {
        setMessage(`❌ Error seeding price chart: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const cleanInvalidData = async () => {
    if (window.confirm('This will clean up any invalid payal type data in the database. Continue?')) {
      try {
        setLoading(true);
        // Note: This would require a new API endpoint to trigger the cleanup script
        // For now, we'll just show a message to run the script manually
        setMessage('⚠️ To clean invalid data, please run: npm run clean-payal-types in the backend directory');
      } catch (error) {
        setMessage(`❌ Error cleaning data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Download Excel file for all wire data
  const downloadAllWireData = () => {
    if (allWires.length === 0) {
      setMessage('⚠️ No wire data available to download');
      return;
    }

    const rows = [['Wire Thickness', 'Payal Type', 'Price per Kg (₹)', 'Status']];
    
    allWires.forEach(wireName => {
      const wirePayalTypes = priceChart[wireName] || {};
      
      if (Object.keys(wirePayalTypes).length === 0) {
        // Wire with no payal prices
        rows.push([wireName, 'No payal types', '0', 'No prices set']);
      } else {
        // Wire with payal prices
        Object.entries(wirePayalTypes).forEach(([payalType, price]) => {
          rows.push([wireName, payalType, price.toString(), 'Active']);
        });
      }
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Wire_Payal_Data_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setMessage('✅ Wire data downloaded successfully!');
  };

  // Download Excel file for specific wire
  const downloadWireData = (wireName) => {
    const wirePayalTypes = priceChart[wireName] || {};
    
    if (Object.keys(wirePayalTypes).length === 0) {
      setMessage(`⚠️ No payal price data available for ${wireName}`);
      return;
    }

    const rows = [['Wire Thickness', 'Payal Type', 'Price per Kg (₹)', 'Date Exported']];
    const exportDate = new Date().toLocaleDateString('en-GB');
    
    Object.entries(wirePayalTypes).forEach(([payalType, price]) => {
      rows.push([wireName, payalType, price.toString(), exportDate]);
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${wireName}_Payal_Data_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setMessage(`✅ ${wireName} data downloaded successfully!`);
  };

  return (
    <div className="panel data-management">
      <h2 style={{color: '#341f97'}}>🗃️ Wire & Payal Management</h2>
      
      {message && (
        <div className={`message ${message.includes('❌') ? 'error' : message.includes('⚠️') ? 'warning' : 'success'}`}
          style={{
            padding: '10px',
            marginBottom: '20px',
            borderRadius: '4px',
            backgroundColor: message.includes('✅') ? '#d4edda' : message.includes('❌') ? '#f8d7da' : '#fff3cd',
            color: message.includes('✅') ? '#155724' : message.includes('❌') ? '#721c24' : '#856404'
          }}>
          {message}
        </div>
      )}

      {/* Add New Wire */}
      <div className="management-section" style={{ marginBottom: '30px' }}>
        <h3>➕ Add New Wire</h3>
        <div className="form-section" style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={newWire}
            onChange={(e) => setNewWire(e.target.value)}
            placeholder="Enter wire name (e.g., 22mm, 28mm)"
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button 
            className="add-btn" 
            onClick={addWire}
            disabled={loading || !newWire.trim()}
          >
            {loading ? '⏳ Adding...' : '➕ Add Wire'}
          </button>
        </div>
      </div>

      {/* Price Chart Table */}
      <div className="management-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>💎 Payal Price Chart (₹ per kg)</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* <button 
              onClick={downloadAllWireData}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#27ae60', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontSize: '14px',
                fontWeight: '600'
              }}
              disabled={loading || allWires.length === 0}
            >
              📥 Download All Data
            </button> */}
            {/* <button 
              onClick={seedPriceChart}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#3742fa', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontSize: '14px',
                fontWeight: '600'
              }}
              disabled={loading}
            >
              {loading ? '⏳ Seeding...' : '🌱 Seed Default Data'}
            </button> */}
          </div>
        </div>
        
        {allWires.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '2px dashed #dee2e6'
          }}>
            <h4 style={{ color: '#6c757d', marginBottom: '15px' }}>📊 No Wires Found</h4>
            <p style={{ color: '#6c757d', marginBottom: '20px' }}>
              No wires have been added yet. Add a wire using the form above, then you can add payal prices to it.
            </p>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>🔧</div>
          </div>
        ) : (
          allWires.map(wireName => (
          <div key={wireName} style={{ marginBottom: '30px', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#f9f9f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, color: '#341f97' }}>📏 Wire: {wireName}</h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                {/* <button 
                  onClick={() => downloadWireData(wireName)}
                  style={{ padding: '8px 15px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                  disabled={loading || !priceChart[wireName] || Object.keys(priceChart[wireName] || {}).length === 0}
                >
                  📥 Download
                </button> */}
                <button 
                  onClick={() => startAddingPayal(wireName)}
                  style={{ padding: '8px 15px', backgroundColor: '#10ac84', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                  disabled={loading}
                >
                  ➕ Add Payal
                </button>
                <button 
                  onClick={() => deleteWire(wireName)}
                  style={{ padding: '8px 15px', backgroundColor: '#ee5a6f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                  disabled={loading}
                >
                  🗑️ Delete Wire
                </button>
              </div>
            </div>

            {/* Add Payal Form */}
            {addingPayalFor === wireName && (
              <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#fff', borderRadius: '4px', border: '2px solid #10ac84' }}>
                <h5 style={{ marginTop: 0 }}>Add New Payal to {wireName}</h5>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold' }}>Payal Name</label>
                    <input
                      type="text"
                      value={newPayalName}
                      onChange={(e) => setNewPayalName(e.target.value)}
                      placeholder="e.g., Moorni, Silver, Golden"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold' }}>Price (₹ per kg)</label>
                    <input
                      type="number"
                      value={newPayalPrice}
                      onChange={(e) => setNewPayalPrice(e.target.value)}
                      placeholder="Enter price"
                      min="0"
                      step="0.01"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                  </div>
                  <button 
                    onClick={addPayalToWire}
                    style={{ padding: '8px 15px', backgroundColor: '#10ac84', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    disabled={loading}
                  >
                    {loading ? '⏳ Adding...' : '✓ Add'}
                  </button>
                  <button 
                    onClick={cancelAddPayal}
                    style={{ padding: '8px 15px', backgroundColor: '#ee5a6f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    disabled={loading}
                  >
                    ✗ Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Payal List */}
            <table style={{ width: '100%', backgroundColor: 'white', borderRadius: '4px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ backgroundColor: '#341f97', color: 'white' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Payal Type</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Price (₹ per kg)</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {priceChart[wireName] && Object.keys(priceChart[wireName]).length > 0 ? (
                  Object.keys(priceChart[wireName]).map(payalType => (
                  <tr key={payalType} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>
                      <strong>{payalType}</strong>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {editingWire === wireName ? (
                        <input
                          type="number"
                          value={editPrices[payalType] || 0}
                          onChange={(e) => handlePriceChange(payalType, e.target.value)}
                          style={{ width: '100px', padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#10ac84' }}>₹{priceChart[wireName][payalType]}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {editingWire === wireName ? (
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button 
                            onClick={saveEdit}
                            style={{ padding: '5px 10px', backgroundColor: '#10ac84', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            disabled={loading}
                          >
                            {loading ? '⏳ Saving...' : '✓ Save'}
                          </button>
                          <button 
                            onClick={cancelEdit}
                            style={{ padding: '5px 10px', backgroundColor: '#ee5a6f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            disabled={loading}
                          >
                            ✗ Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button 
                            onClick={() => startEdit(wireName)}
                            style={{ padding: '5px 10px', backgroundColor: '#5f27cd', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            disabled={loading}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            onClick={() => deletePayal(wireName, payalType)}
                            style={{ padding: '5px 10px', backgroundColor: '#ee5a6f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            disabled={loading}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
                ) : (
                  <tr>
                    <td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                      No payal prices added yet. Click "➕ Add Payal" to add the first payal type and price.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )))}
      </div>
      
    </div>
  );
};

export default DataManagement;
