import { useState, useEffect } from 'react';
import apiService from '../services/api';

const WireManagement = ({ onDataUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Wire Management states
  const [newWire, setNewWire] = useState('');
  const [allWires, setAllWires] = useState([]);
  const [priceChart, setPriceChart] = useState({});
  const [editingWire, setEditingWire] = useState(null);
  const [editPrices, setEditPrices] = useState({});
  const [addingPayalFor, setAddingPayalFor] = useState(null);
  const [newPayalName, setNewPayalName] = useState('');
  const [newPayalPrice, setNewPayalPrice] = useState('');

  useEffect(() => {
    loadWiresAndPrices();
  }, []);

  const loadWiresAndPrices = async () => {
    try {
      const [itemsData, priceChartData] = await Promise.all([
        apiService.getAllItems(),
        apiService.getPayalPriceChart()
      ]);
      setAllWires(itemsData.map(item => item.name));
      setPriceChart(priceChartData);
    } catch (error) {
    }
  };

  const addWire = async () => {
    if (!newWire.trim()) {
      setMessage({ text: '⚠️ Please enter a wire name', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      await apiService.addItem(newWire.trim());
      
      setNewWire('');
      setMessage({ text: `✅ Wire "${newWire}" added successfully. Now add payal types and prices.`, type: 'success' });
      
      await loadWiresAndPrices();
      if (onDataUpdate) onDataUpdate();
    } catch (error) {
      setMessage({ text: `❌ Error adding wire: ${error.message}`, type: 'error' });
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
      
      for (const [payalType, price] of Object.entries(editPrices)) {
        await apiService.updatePayalPrice(editingWire, payalType, price);
      }
      
      setMessage({ text: `✅ Prices updated for ${editingWire}`, type: 'success' });
      setEditingWire(null);
      setEditPrices({});
      
      await loadWiresAndPrices();
    } catch (error) {
      setMessage({ text: `❌ Error updating prices: ${error.message}`, type: 'error' });
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
      setMessage({ text: '⚠️ Please enter payal name', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      // Add payal type with default price of 0 (prices will be set per vendor)
      await apiService.addPayalPrice(addingPayalFor, newPayalName.trim(), 0);
      
      setMessage({ text: `✅ ${newPayalName} payal type added to ${addingPayalFor}. Prices will be set per vendor.`, type: 'success' });
      cancelAddPayal();
      
      await loadWiresAndPrices();
    } catch (error) {
      setMessage({ text: `❌ Error adding payal type: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const deletePayal = async (wireName, payalName) => {
    if (window.confirm(`Delete ${payalName} payal from ${wireName}?`)) {
      try {
        setLoading(true);
        await apiService.deletePayalPrice(wireName, payalName);
        
        setMessage({ text: `✅ ${payalName} payal deleted from ${wireName}`, type: 'success' });
        
        await loadWiresAndPrices();
      } catch (error) {
        setMessage({ text: `❌ Error deleting payal: ${error.message}`, type: 'error' });
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
        
        if (hasPayalPrices) {
          try {
            await apiService.deleteWireFromPriceChart(wireName);
          } catch (priceChartError) {
          }
        }
        
        try {
          await apiService.deleteItem(wireName);
        } catch (itemError) {
        }
        
        setMessage({ text: `✅ Wire "${wireName}" deleted successfully`, type: 'success' });
        
        await loadWiresAndPrices();
        if (onDataUpdate) onDataUpdate();
      } catch (error) {
        setMessage({ text: `❌ Error deleting wire: ${error.message}`, type: 'error' });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="panel wire-management" style={{
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '40px',
        padding: '30px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        color: 'white',
        boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
      }}>
        <h2 style={{
          margin: '0 0 10px 0',
          fontSize: '32px',
          fontWeight: '700',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          🗃️ Wire & Payal Management
        </h2>
        <p style={{
          margin: 0,
          fontSize: '16px',
          opacity: 0.9,
          fontWeight: '300'
        }}>
          Manage wire types and payal configurations
        </p>
        <div style={{
          marginTop: '15px',
          fontSize: '14px',
          opacity: 0.8,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px'
        }}>
          <span>📊 Total Wires: <strong>{allWires.length}</strong></span>
          <span>•</span>
          <span>🆕 Easy Management</span>
        </div>
      </div>

      {/* Wire & Payal Management Section */}
      <div className="management-section" style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
        padding: '35px',
        borderRadius: '20px',
        boxShadow: '0 15px 35px rgba(0,0,0,0.1), 0 5px 15px rgba(0,0,0,0.07)',
        marginBottom: '40px',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <h3 style={{
          marginTop: 0,
          color: '#2c3e50',
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          fontSize: '24px',
          fontWeight: '600',
          marginBottom: '25px'
        }}>
          <span style={{
            fontSize: '28px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>🗃️</span>
          Wire & Payal Management
        </h3>

        {/* Add New Wire */}
        <div style={{ marginBottom: '30px' }}>
          <h4 style={{ color: '#2c3e50', marginBottom: '15px' }}>➕ Add New Wire</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={newWire}
              onChange={(e) => setNewWire(e.target.value)}
              placeholder="Enter wire name (e.g., 22mm, 28mm)"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 15px',
                fontSize: '14px',
                border: '2px solid #e1e8ed',
                borderRadius: '8px',
                outline: 'none'
              }}
            />
            <button
              onClick={addWire}
              disabled={loading || !newWire.trim()}
              style={{
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: newWire.trim() ? '#667eea' : '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: newWire.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              {loading ? '⏳ Adding...' : '➕ Add Wire'}
            </button>
          </div>
        </div>

        {/* Wire & Payal Type Management */}
        <div>
          <h4 style={{ color: '#2c3e50', marginBottom: '20px' }}>💎 Wire & Payal Type Management</h4>
          <div style={{
            padding: '12px',
            backgroundColor: '#e8f4fd',
            border: '1px solid #bee5eb',
            borderRadius: '8px',
            marginBottom: '20px',
            color: '#0c5460'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span>ℹ️</span>
              <strong>How Pricing Works</strong>
            </div>
            <p style={{ margin: '0', fontSize: '14px' }}>
              This section manages available wire types and payal types. 
              <strong> Actual prices are set individually for each vendor</strong> through the wire assignment system.
            </p>
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
              <div key={wireName} style={{
                marginBottom: '30px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#f9f9f9'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '15px'
                }}>
                  <h4 style={{ margin: 0, color: '#341f97' }}>📏 Wire: {wireName}</h4>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => startAddingPayal(wireName)}
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#10ac84',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                      disabled={loading}
                    >
                      ➕ Add Payal
                    </button>
                    <button
                      onClick={() => deleteWire(wireName)}
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#ee5a6f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                      disabled={loading}
                    >
                      🗑️ Delete Wire
                    </button>
                  </div>
                </div>

                {/* Add Payal Form */}
                {addingPayalFor === wireName && (
                  <div style={{
                    marginBottom: '15px',
                    padding: '15px',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    border: '2px solid #10ac84'
                  }}>
                    <h5 style={{ marginTop: 0 }}>Add New Payal Type to {wireName}</h5>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{
                          display: 'block',
                          marginBottom: '5px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          Payal Name
                        </label>
                        <input
                          type="text"
                          value={newPayalName}
                          onChange={(e) => setNewPayalName(e.target.value)}
                          placeholder="e.g., Moorni, Silver, Golden"
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                          }}
                        />
                      </div>
                      <button
                        onClick={addPayalToWire}
                        style={{
                          padding: '8px 15px',
                          backgroundColor: '#10ac84',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        disabled={loading}
                      >
                        {loading ? '⏳ Adding...' : '✓ Add Payal Type'}
                      </button>
                      <button
                        onClick={cancelAddPayal}
                        style={{
                          padding: '8px 15px',
                          backgroundColor: '#ee5a6f',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        disabled={loading}
                      >
                        ✗ Cancel
                      </button>
                    </div>
                    <p style={{ 
                      margin: '10px 0 0 0', 
                      fontSize: '12px', 
                      color: '#666',
                      fontStyle: 'italic' 
                    }}>
                      💡 Note: Prices will be set individually for each vendor through wire assignments.
                    </p>
                  </div>
                )}

                {/* Payal List Table */}
                <table style={{
                  width: '100%',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#341f97', color: 'white' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Available Payal Types</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceChart[wireName] && Object.keys(priceChart[wireName]).length > 0 ? (
                      Object.keys(priceChart[wireName]).map(payalType => (
                        <tr key={payalType} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '18px' }}>
                                {payalType === 'Moorni' ? '🔷' :
                                 payalType === 'Silver' ? '⚪' :
                                 payalType === 'Golden' ? '🟡' :
                                 payalType === 'Diamond' ? '💎' : '💎'}
                              </span>
                              <strong style={{ fontSize: '16px', color: '#2c3e50' }}>
                                {payalType}
                              </strong>
                              <span style={{ 
                                fontSize: '12px', 
                                color: '#666', 
                                fontStyle: 'italic',
                                marginLeft: '10px'
                              }}>
                                (Prices set per vendor)
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button
                              onClick={() => deletePayal(wireName, payalType)}
                              style={{
                                padding: '8px 15px',
                                backgroundColor: '#ee5a6f',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                              disabled={loading}
                            >
                              🗑️ Remove Payal Type
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" style={{
                          padding: '30px',
                          textAlign: 'center',
                          color: '#6c757d'
                        }}>
                          <div style={{ fontSize: '48px', marginBottom: '15px' }}>💎</div>
                          <h4 style={{ margin: '0 0 10px 0', color: '#6c757d' }}>No Payal Types Added</h4>
                          <p style={{ margin: '0', fontSize: '14px' }}>
                            Click "➕ Add Payal" to add payal types for this wire.
                            Prices will be set individually for each vendor.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        {message.text && (
          <div 
            className={`message ${message.type}`}
            style={{
              marginTop: '20px',
              padding: '15px 20px',
              borderRadius: '8px',
              backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
              color: message.type === 'success' ? '#155724' : '#721c24',
              border: `2px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
              fontSize: '15px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span style={{ fontSize: '20px' }}>
              {message.type === 'success' ? '✅' : '❌'}
            </span>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default WireManagement;
