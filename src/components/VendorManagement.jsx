import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

const VendorManagement = ({ onDataUpdate }) => {
  const navigate = useNavigate();
  const [vendorForm, setVendorForm] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Vendor Wire Assignment states
  const [assigningToVendor, setAssigningToVendor] = useState(null);
  const [selectedWire, setSelectedWire] = useState('');
  const [selectedPayal, setSelectedPayal] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [allWires, setAllWires] = useState([]);
  const [priceChart, setPriceChart] = useState({});
  const wireSelectRef = useRef(null);
  const priceInputRef = useRef(null);

  // Vendor Edit states
  const [editingVendor, setEditingVendor] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    loadVendors();
    loadWiresAndPrices();
  }, []);

  const loadVendors = async () => {
    try {
      const vendorsData = await apiService.getAllVendors();
      setVendors(vendorsData);
    } catch (error) {
    }
  };

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

  const handleInputChange = (field, value) => {
    setVendorForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddVendor = async () => {
    if (!vendorForm.name.trim()) {
      setMessage({ text: '⚠️ Vendor name is required', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      await apiService.addVendor(vendorForm.name, vendorForm.phone, vendorForm.address);
      setMessage({ text: '✅ Vendor added successfully!', type: 'success' });
      setVendorForm({ name: '', phone: '', address: '' });
      
      await loadVendors();
      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (error) {
      setMessage({ text: `❌ ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVendorClick = (vendorName) => {
    // Store the selected vendor name in sessionStorage for the SearchVendorSection
    sessionStorage.setItem('selectedVendor', vendorName);
    // Navigate to the vendor profile (search) page
    navigate('/search');
  };


  // Vendor Wire Assignment Functions
  const startAssigningWire = (vendor) => {
    setAssigningToVendor(vendor);
    setSelectedWire('');
    setSelectedPayal('');
    setCustomPrice('');
    // Auto-focus the wire select after modal opens
    setTimeout(() => {
      if (wireSelectRef.current) {
        wireSelectRef.current.focus();
      }
    }, 100);
  };

  const cancelWireAssignment = () => {
    setAssigningToVendor(null);
    setSelectedWire('');
    setSelectedPayal('');
    setCustomPrice('');
  };

  const assignWireToVendor = async () => {
    if (!selectedWire) {
      setMessage({ text: '⚠️ Please select a wire', type: 'error' });
      return;
    }
    if (!selectedPayal) {
      setMessage({ text: '⚠️ Please select a payal type', type: 'error' });
      return;
    }
    if (!customPrice || parseFloat(customPrice) <= 0) {
      setMessage({ text: '⚠️ Please enter a valid price', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      await apiService.assignWireToVendor(
        assigningToVendor._id,
        selectedWire,
        selectedPayal,
        parseFloat(customPrice)
      );
      
      setMessage({ text: `✅ Wire assigned to ${assigningToVendor.name} successfully!`, type: 'success' });
      cancelWireAssignment();
      
      await loadVendors();
    } catch (error) {
      setMessage({ text: `❌ Error assigning wire: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePriceKeyPress = (e) => {
    if (e.key === 'Enter' && selectedWire && selectedPayal && customPrice && parseFloat(customPrice) > 0) {
      e.preventDefault();
      assignWireToVendor();
    }
  };

  const removeWireFromVendor = async (vendor, assignmentId) => {
    const confirmMessage = `⚠️ Are you sure you want to remove this wire assignment from ${vendor.name}?\n\n` +
      `This action cannot be undone.\n\n` +
      `Type "yes" (lowercase) to confirm:`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput === 'yes') {
      try {
        setLoading(true);
        setMessage({ text: '', type: '' }); // Clear any previous messages
        
        console.log('Removing wire assignment:', { vendorId: vendor._id, assignmentId });
        
        const result = await apiService.removeWireFromVendor(vendor._id, assignmentId);
        
        console.log('Wire removed successfully:', result);
        
        setMessage({ text: `✅ Wire assignment removed from ${vendor.name}`, type: 'success' });
        
        // Refresh vendor list to show updated data
        await loadVendors();
        
        // Call parent callback if provided
        if (onDataUpdate) {
          onDataUpdate();
        }
        
        // Auto-clear success message after 3 seconds
        setTimeout(() => {
          setMessage({ text: '', type: '' });
        }, 3000);
      } catch (error) {
        console.error('Error removing wire assignment:', error);
        setMessage({ text: `❌ Error removing wire assignment: ${error.message}`, type: 'error' });
      } finally {
        setLoading(false);
      }
    } else if (userInput !== null) {
      setMessage({ 
        text: '❌ Removal cancelled. You must type "yes" exactly to confirm.', 
        type: 'error' 
      });
    }
  };

  // Vendor Edit Functions
  const startEditingVendor = (vendor) => {
    setEditingVendor(vendor);
    setEditForm({
      name: vendor.name,
      phone: vendor.phone || '',
      address: vendor.address || ''
    });
  };

  const cancelEditVendor = () => {
    setEditingVendor(null);
    setEditForm({ name: '', phone: '', address: '' });
  };

  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const saveVendorEdit = async () => {
    if (!editForm.name.trim()) {
      setMessage({ text: '⚠️ Vendor name is required', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      await apiService.updateVendor(
        editingVendor._id,
        editForm.name,
        editForm.phone,
        editForm.address
      );
      
      setMessage({ text: `✅ Vendor "${editForm.name}" updated successfully!`, type: 'success' });
      cancelEditVendor();
      
      await loadVendors();
      if (onDataUpdate) {
        onDataUpdate();
      }
    } catch (error) {
      setMessage({ text: `❌ Failed to update vendor: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const deleteVendor = async (vendor) => {
    const confirmMessage = `⚠️ Are you sure you want to delete vendor "${vendor.name}"?\n\n` +
      `This will permanently remove:\n` +
      `• Vendor information (${vendor.name}, ${vendor.phone || 'No phone'}, ${vendor.address || 'No address'})\n` +
      `• ${vendor.assignedWires?.length || 0} assigned wire configurations\n\n` +
      `Note: If this vendor has transactions, deletion will be blocked.\n\n` +
      `Type "yes" (lowercase) to confirm:`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput === 'yes') {
      try {
        setLoading(true);
        await apiService.deleteVendor(vendor._id);
        
        setMessage({ 
          text: `✅ Vendor "${vendor.name}" deleted successfully!`, 
          type: 'success' 
        });
        
        await loadVendors();
        if (onDataUpdate) {
          onDataUpdate();
        }
      } catch (error) {
        setMessage({ 
          text: `❌ Failed to delete vendor: ${error.message}`, 
          type: 'error' 
        });
      } finally {
        setLoading(false);
      }
    } else if (userInput !== null) {
      setMessage({ 
        text: '❌ Deletion cancelled. You must type "yes" exactly to confirm.', 
        type: 'error' 
      });
    }
  };

  return (
    <div className="panel vendor-management" style={{
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
          👥 Vendor Management
        </h2>
        <p style={{
          margin: 0,
          fontSize: '16px',
          opacity: 0.9,
          fontWeight: '300'
        }}>
          Add and manage your vendors with contact details
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
          <span>📊 Total Vendors: <strong>{vendors.length}</strong></span>
          <span>•</span>
          <span>🆕 Easy Management</span>
        </div>
      </div>
      
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
          }}>➕</span> 
          Add New Vendor
        </h3>
        
        <div className="form-section" style={{ display: 'grid', gap: '20px' }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              Vendor Name <span style={{color: '#e74c3c'}}>*</span>
            </label>
            <input
              type="text"
              value={vendorForm.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter vendor name"
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px 20px',
                fontSize: '16px',
                border: '2px solid #e1e8ed',
                borderRadius: '12px',
                transition: 'all 0.3s ease',
                outline: 'none',
                backgroundColor: '#fafbfc',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.backgroundColor = '#ffffff';
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e1e8ed';
                e.target.style.backgroundColor = '#fafbfc';
                e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                e.target.style.transform = 'translateY(0)';
              }}
            />
          </div>
          
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              📱 Phone Number
            </label>
            <input
              type="tel"
              value={vendorForm.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="Enter phone number"
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px 20px',
                fontSize: '16px',
                border: '2px solid #e1e8ed',
                borderRadius: '12px',
                transition: 'all 0.3s ease',
                outline: 'none',
                backgroundColor: '#fafbfc',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.backgroundColor = '#ffffff';
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e1e8ed';
                e.target.style.backgroundColor = '#fafbfc';
                e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                e.target.style.transform = 'translateY(0)';
              }}
            />
          </div>
          
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              📍 Address
            </label>

            
            <textarea
              value={vendorForm.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Enter vendor address"
              rows="3"
              disabled={loading}
              style={{
                width: '100%',
                height:'55px',
                padding: '15px 20px',
                fontSize: '16px',
                border: '2px solid #e1e8ed',
                borderRadius: '12px',
                fontFamily: 'inherit',
                resize: 'vertical',
                transition: 'all 0.3s ease',
                outline: 'none',
                backgroundColor: '#fafbfc',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.backgroundColor = '#ffffff';
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e1e8ed';
                e.target.style.backgroundColor = '#fafbfc';
                e.target.style.boxShadow = '0 2px 4px rgba(255, 255, 255, 0.02)';
                e.target.style.transform = 'translateY(0)';
              }}
            />
          </div>


          {/* <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              Price
            </label>
            <input
              type="tel"
              value={vendorForm.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="Enter  Price"
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px 20px',
                fontSize: '16px',
                border: '2px solid #e1e8ed',
                borderRadius: '12px',
                transition: 'all 0.3s ease',
                outline: 'none',
                backgroundColor: '#fafbfc',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.backgroundColor = '#ffffff';
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e1e8ed';
                e.target.style.backgroundColor = '#fafbfc';
                e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                e.target.style.transform = 'translateY(0)';
              }}
            />
          </div> */}
          
          <button 
            className="add-btn" 
            onClick={handleAddVendor}
            disabled={loading || !vendorForm.name.trim()}
            style={{ 
              width: '100%',
              padding: '18px 24px',
              fontSize: '18px',
              fontWeight: '700',
              background: loading || !vendorForm.name.trim() 
                ? 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '15px',
              cursor: loading || !vendorForm.name.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: loading || !vendorForm.name.trim() 
                ? '0 4px 15px rgba(149, 165, 166, 0.2)' 
                : '0 8px 25px rgba(102, 126, 234, 0.3)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              if (!loading && vendorForm.name.trim()) {
                e.target.style.background = 'linear-gradient(135deg, #5a67d8 0%, #667eea 100%)';
                e.target.style.transform = 'translateY(-3px) scale(1.02)';
                e.target.style.boxShadow = '0 12px 35px rgba(102, 126, 234, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && vendorForm.name.trim()) {
                e.target.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                e.target.style.transform = 'translateY(0) scale(1)';
                e.target.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.3)';
              }
            }}
          >
            {loading ? '⏳ Adding Vendor...' : '➕ Add Vendor'}
          </button>
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


      {/* Vendor List */}
      {vendors.length > 0 && (
        <div className="management-section" style={{
          background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
          padding: '35px',
          borderRadius: '20px',
          boxShadow: '0 15px 35px rgba(0,0,0,0.1), 0 5px 15px rgba(0,0,0,0.07)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <h3 style={{ 
            color: '#2c3e50', 
            marginBottom: '30px',
            fontSize: '24px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: '28px'
            }}>📋</span>
            All Vendors ({vendors.length})
          </h3>
          <div style={{ display: 'grid', gap: '20px' }}>
            {vendors.map((vendor, index) => (
              <div 
                key={vendor._id || index} 
                onClick={() => handleVendorClick(vendor.name)}
                style={{
                  background: 'linear-gradient(145deg, #ffffff 0%, #fafbfc 100%)',
                  padding: '25px',
                  borderRadius: '18px',
                  border: '2px solid #e1e8ed',
                  boxShadow: '0 5px 15px rgba(0,0,0,0.08)',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.boxShadow = '0 15px 35px rgba(102, 126, 234, 0.2)';
                  e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                  e.currentTarget.style.background = 'linear-gradient(145deg, #ffffff 0%, #f0f4ff 100%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e1e8ed';
                  e.currentTarget.style.boxShadow = '0 5px 15px rgba(0,0,0,0.08)';
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.background = 'linear-gradient(145deg, #ffffff 0%, #fafbfc 100%)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                    fontWeight: '700',
                    flexShrink: 0,
                    boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)',
                    border: '3px solid rgba(255,255,255,0.2)',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    {vendor.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '18px' }}>
                      {vendor.name}
                    </h4>
                    {vendor.phone && (
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📱</span> {vendor.phone}
                      </p>
                    )}
                    {vendor.address && (
                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span>📍</span> <span>{vendor.address}</span>
                      </p>
                    )}
                    
                    {/* Display Assigned Wires */}
                    {vendor.assignedWires && vendor.assignedWires.length > 0 && (
                      <div style={{ marginTop: '15px' }}>
                        <p style={{ 
                          margin: '0 0 10px 0', 
                          fontSize: '13px', 
                          fontWeight: '700', 
                          color: '#2c3e50',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            fontSize: '16px'
                          }}>🔧</span>
                          Assigned Wires ({vendor.assignedWires.length})
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {vendor.assignedWires.map((wire) => (
                            <div
                              key={wire._id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                                border: '2px solid #667eea',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: '600'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                <span style={{ 
                                  color: '#667eea', 
                                  fontWeight: '700'
                                }}>
                                  {wire.wireName}
                                </span>
                                <span style={{ opacity: 0.6, fontSize: '10px' }}>•</span>
                                <span style={{ color: '#666' }}>
                                  {wire.payalType === 'Moorni' ? '🔷 Moorni' :
                                   wire.payalType === 'Silver' ? '⚪ Silver' :
                                   wire.payalType === 'Golden' ? '🟡 Golden' :
                                   wire.payalType === 'Diamond' ? '💎 Diamond' : `💎 ${wire.payalType}`}
                                </span>
                                <span style={{ opacity: 0.6, fontSize: '10px' }}>•</span>
                                <span style={{ 
                                  color: '#10ac84', 
                                  fontWeight: '700'
                                }}>
                                  ₹{wire.pricePerKg}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeWireFromVendor(vendor, wire._id);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '10px',
                                  backgroundColor: '#ee5a6f',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer'
                                }}
                                disabled={loading}
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ 
                      marginTop: '15px',
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startAssigningWire(vendor);
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: '#10ac84',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                        disabled={loading}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#0e9470';
                          e.target.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#10ac84';
                          e.target.style.transform = 'scale(1)';
                        }}
                      >
                        🔧 Assign Wire
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingVendor(vendor);
                        }}
                        style={{
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: '#3498db',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                        disabled={loading}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#2980b9';
                          e.target.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#3498db';
                          e.target.style.transform = 'scale(1)';
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteVendor(vendor);
                        }}
                        style={{
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: '#ee5a6f',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                        disabled={loading}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#dc3545';
                          e.target.style.transform = 'scale(1.05)';
                          e.target.style.boxShadow = '0 4px 15px rgba(238, 90, 111, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#ee5a6f';
                          e.target.style.transform = 'scale(1)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        🗑️ Delete
                      </button>
                      <div style={{ 
                        flex: 2,
                        padding: '8px 12px', 
                        backgroundColor: 'rgba(102, 126, 234, 0.1)', 
                        borderRadius: '8px', 
                        fontSize: '12px', 
                        color: '#667eea', 
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        👆 Click to view profile
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Vendor Modal */}
      {editingVendor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '15px',
            width: '500px',
            maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#2c3e50',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>✏️</span>
              Edit Vendor: {editingVendor.name}
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Vendor Name <span style={{color: '#e74c3c'}}>*</span>
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => handleEditFormChange('name', e.target.value)}
                placeholder="Enter vendor name"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                📱 Phone Number
              </label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => handleEditFormChange('phone', e.target.value)}
                placeholder="Enter phone number"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                📍 Address
              </label>
              <textarea
                value={editForm.address}
                onChange={(e) => handleEditFormChange('address', e.target.value)}
                placeholder="Enter vendor address"
                rows="3"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={cancelEditVendor}
                style={{
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={saveVendorEdit}
                disabled={loading || !editForm.name.trim()}
                style={{
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: editForm.name.trim() ? '#3498db' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: editForm.name.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                {loading ? '⏳ Saving...' : '✅ Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wire Assignment Modal */}
      {assigningToVendor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '15px',
            width: '500px',
            maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#2c3e50',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>🔧</span>
              Assign Wire to {assigningToVendor.name}
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Select Wire
              </label>
              <select
                ref={wireSelectRef}
                value={selectedWire}
                onChange={(e) => {
                  setSelectedWire(e.target.value);
                  setSelectedPayal('');
                  setCustomPrice('');
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              >
                <option value="">Select Wire</option>
                {allWires.map(wire => (
                  <option key={wire} value={wire}>{wire}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Select Payal Type
              </label>
              <select
                value={selectedPayal}
                onChange={(e) => {
                  setSelectedPayal(e.target.value);
                  // Clear price when payal changes (prices are vendor-specific now)
                  setCustomPrice('');
                }}
                disabled={!selectedWire}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  outline: 'none',
                  backgroundColor: selectedWire ? 'white' : '#f8f9fa',
                  cursor: selectedWire ? 'pointer' : 'not-allowed'
                }}
              >
                <option value="">{!selectedWire ? 'Select Wire First' : 'Select Payal'}</option>
                {selectedWire && priceChart[selectedWire] && Object.keys(priceChart[selectedWire]).map(payal => (
                  <option key={payal} value={payal}>
                    {payal === 'Moorni' ? '🔷 Moorni' :
                     payal === 'Silver' ? '⚪ Silver' :
                     payal === 'Golden' ? '🟡 Golden' :
                     payal === 'Diamond' ? '💎 Diamond' : `💎 ${payal}`}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Price (₹ per kg)
              </label>
              <input
                ref={priceInputRef}
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                onKeyPress={handlePriceKeyPress}
                placeholder="Enter custom price"
                min="0"
                step="0.01"
                disabled={!selectedPayal}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '2px solid #e1e8ed',
                  borderRadius: '8px',
                  outline: 'none',
                  backgroundColor: selectedPayal ? 'white' : '#f8f9fa'
                }}
              />
              <p style={{
                margin: '5px 0 0 0',
                fontSize: '12px',
                color: '#666',
                fontStyle: 'italic'
              }}>
                💡 Set a custom price for this vendor's wire-payal combination
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={cancelWireAssignment}
                style={{
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={assignWireToVendor}
                disabled={loading || !selectedWire || !selectedPayal || !customPrice}
                style={{
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: selectedWire && selectedPayal && customPrice ? '#10ac84' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedWire && selectedPayal && customPrice ? 'pointer' : 'not-allowed'
                }}
              >
                {loading ? '⏳ Assigning...' : '✅ Assign Wire'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorManagement;
