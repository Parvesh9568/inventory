import React, { useState, useEffect } from 'react';
import apiService from '../services/api';

const Payment = () => {
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [allWiresData, setAllWiresData] = useState([]); // Store data for all wires
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [priceChart, setPriceChart] = useState({});
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Screenshot function
  const takeScreenshot = async () => {
    try {
      const element = document.querySelector('.payment-container');
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `Payment_Screenshot_${timestamp}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
      
      alert('✅ Screenshot saved!');
    } catch (error) {
      alert('❌ Failed to take screenshot: ' + error.message);
    }
  };

  // Load vendors on component mount
  useEffect(() => {
    loadVendors();
    loadPayments();
    loadPriceChart();
  }, []);

  const loadVendors = async () => {
    setVendorsLoading(true);
    try {
      const vendorList = await apiService.getAllVendors();
      setVendors(vendorList || []);
    } catch (error) {
      alert('❌ Failed to load vendors. Check if backend server is running on port 4003.\nError: ' + error.message);
      setVendors([]);
    } finally {
      setVendorsLoading(false);
    }
  };

  const loadPayments = async (vendorName = null) => {
    try {
      let paymentsData;
      
      if (vendorName) {
        // Load vendor-specific payments from database
        paymentsData = await apiService.getVendorPayments(vendorName);
      } else {
        // Load all payments from database
        paymentsData = await apiService.getAllPayments();
      }
      
      setPayments(paymentsData || []);
    } catch (error) {
      // Fallback to localStorage if database fails
      try {
        const savedPayments = JSON.parse(localStorage.getItem('vendorPayments') || '[]');
        const filteredPayments = vendorName 
          ? savedPayments.filter(p => p.vendor === vendorName)
          : savedPayments;
        setPayments(filteredPayments);
      } catch (localError) {
        setPayments([]);
      }
    }
  };

  const loadPriceChart = async () => {
    try {
      const chart = await apiService.getPayalPriceChart();
      setPriceChart(chart || {});
    } catch (error) {
      setPriceChart({});
    }
  };

  // Helper function to get vendor-specific assigned price or fallback to payal price chart
  const getVendorSpecificPrice = (vendorName, wireThickness, payalType) => {
    // First, try to get vendor-specific assigned price
    const vendor = vendors.find(v => (typeof v === 'string' ? v : v.name) === vendorName);
    
    if (vendor && typeof vendor === 'object' && vendor.assignedWires) {
      const assignedWire = vendor.assignedWires.find(aw => 
        aw.wireName === wireThickness && aw.payalType === payalType
      );
      
      if (assignedWire && assignedWire.pricePerKg) {
        return parseFloat(assignedWire.pricePerKg) || 0;
      }
    }
    
    // Fallback to general payal price chart
    if (!priceChart || typeof priceChart !== 'object') {
      return 0;
    }
    
    if (priceChart[wireThickness] && priceChart[wireThickness][payalType]) {
      const price = priceChart[wireThickness][payalType];
      return parseFloat(price) || 0;
    }
    return 0;
  };

  const loadVendorData = async (vendor) => {
    if (!vendor) {
      setAllWiresData([]);
      return;
    }

    setLoading(true);
    try {
      // Get vendor transactions
      const transactions = await apiService.getVendorTransactions(vendor);
      
      if (!transactions || transactions.length === 0) {
        setAllWiresData([]);
        setLoading(false);
        return;
      }
      
      // Group transactions by wire and payal design
      const wireData = {};
      
      transactions.forEach(transaction => {
        const wire = transaction.wireThickness || transaction.item;
        const payalType = transaction.payalType || 'Unknown';
        
        // Skip transactions with Unknown payalType for payment calculations
        if (payalType === 'Unknown' || !payalType || payalType === '') {
          return;
        }
        
        if (!wireData[wire]) {
          wireData[wire] = {};
        }
        
        if (!wireData[wire][payalType]) {
          wireData[wire][payalType] = {
            totalOut: 0,
            totalIn: 0,
            totalPayable: 0,
            transactions: []
          };
        }
        
        wireData[wire][payalType].transactions.push(transaction);
        
        if (transaction.type === 'OUT') {
          const weight = parseFloat(transaction.weight || transaction.qty || 0);
          wireData[wire][payalType].totalOut += weight;
        } else if (transaction.type === 'IN') {
          const weight = parseFloat(transaction.weight || transaction.qty || 0);
          
          // IMPORTANT: Use vendor-specific assigned price, fallback to payal price chart
          const vendorSpecificPrice = getVendorSpecificPrice(vendor, wire, payalType);
          const payableAmount = vendorSpecificPrice * weight;
          
          wireData[wire][payalType].totalIn += weight;
          wireData[wire][payalType].totalPayable += payableAmount;
        }
      });
      
      // Convert wireData to array format with wire-level summaries
      const wiresArray = Object.keys(wireData).map(wireName => {
        const wirePayals = wireData[wireName];
        let wireTotalPayable = 0;
        let wireTotalPaid = 0;
        
        // Calculate totals for this wire across all payal types
        Object.values(wirePayals).forEach(payalInfo => {
          wireTotalPayable += payalInfo.totalPayable;
        });
        
        // Get payments for this wire
        const wirePayments = payments.filter(p => p.vendor === vendor && p.wire === wireName);
        wireTotalPaid = wirePayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        
        return {
          wireName,
          payalTypes: wirePayals,
          totalPayable: wireTotalPayable,
          totalPaid: wireTotalPaid,
          remainingBalance: wireTotalPayable - wireTotalPaid
        };
      });
      
      setAllWiresData(wiresArray);
    } catch (error) {
      alert('❌ Failed to load vendor data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVendorChange = async (vendor) => {
    setSelectedVendor(vendor);
    setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
    
    if (vendor) {
      // Load payments first, then vendor data
      await loadPayments(vendor);
      await loadVendorData(vendor);
    } else {
      setAllWiresData([]);
      setPayments([]);
    }
  };


  // Calculate payment totals for each wire's payal types
  const calculateWirePayalTotals = (wireName, wirePayalTypes) => {
    const payalTotals = {};
    
    // Filter payments for selected vendor and wire
    const wirePayments = payments.filter(p => 
      p.vendor === selectedVendor && p.wire === wireName
    );
    
    Object.keys(wirePayalTypes).forEach(payalType => {
      const payalInfo = wirePayalTypes[payalType];
      
      // Get payments for this specific payal type
      const payalPayments = wirePayments.filter(p => p.payalType === payalType);
      const totalPaid = payalPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      
      payalTotals[payalType] = {
        ...payalInfo,
        totalPaid,
        remainingBalance: payalInfo.totalPayable - totalPaid,
        paymentCount: payalPayments.length
      };
    });
    
    return payalTotals;
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedVendor || !paymentForm.amount) {
      alert('❌ Please fill all required fields');
      return;
    }
    
    const amount = parseFloat(paymentForm.amount);
    if (amount <= 0) {
      alert('❌ Payment amount must be greater than 0');
      return;
    }
    
    // Calculate total payable and total paid
    const totalPayable = allWiresData.reduce((sum, w) => {
      const payalTotals = calculateWirePayalTotals(w.wireName, w.payalTypes);
      return sum + Object.values(payalTotals).reduce((s, p) => s + p.totalPayable, 0);
    }, 0);
    
    const totalPaid = payments
      .filter(p => p.vendor === selectedVendor)
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    const remainingBalance = totalPayable - totalPaid;
    
    // Validation: Payment should not exceed remaining balance
    if (amount > remainingBalance) {
      alert(`❌ Payment amount (₹${amount.toFixed(2)}) cannot exceed remaining balance (₹${remainingBalance.toFixed(2)})\n\nTotal Payable: ₹${totalPayable.toFixed(2)}\nAlready Paid: ₹${totalPaid.toFixed(2)}\nRemaining: ₹${remainingBalance.toFixed(2)}`);
      return;
    }
    
    try {
      const paymentData = {
        vendor: selectedVendor,
        wire: 'Grand Total',
        payalType: 'All',
        amount,
        date: paymentForm.date,
        notes: paymentForm.notes
      };
      
      // Save to database
      const newPayment = await apiService.addPayment(paymentData);
      
      // Reload vendor-specific payments from database to ensure consistency
      await loadPayments(selectedVendor);
      
      // Also save to localStorage as backup
      const allPayments = await apiService.getAllPayments();
      localStorage.setItem('vendorPayments', JSON.stringify(allPayments));
      
      // Reset form
      setPaymentForm({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      
      // Reload vendor data to update calculations
      await loadVendorData(selectedVendor);
      
      alert('✅ Payment recorded successfully in database!');
    } catch (error) {
      alert('❌ Failed to record payment: ' + error.message);
      
      // Try to save to localStorage as fallback
      try {
        const fallbackPayment = {
          id: Date.now().toString(),
          vendor: selectedVendor,
          wire: 'Grand Total',
          payalType: 'All',
          amount,
          date: paymentForm.date,
          notes: paymentForm.notes,
          createdAt: new Date().toISOString()
        };
        
        const updatedPayments = [...payments, fallbackPayment];
        setPayments(updatedPayments);
        localStorage.setItem('vendorPayments', JSON.stringify(updatedPayments));
        
        alert('⚠️ Database failed, but payment saved locally. Please check your connection.');
      } catch (fallbackError) {
      }
    }
  };



  return (
    <div className="payment-container">
      <div className="payment-header">
        <h2>💳 Payment Management</h2>
        <p>Manage vendor payments by payal design</p>
      </div>

      {/* Vendor Selection */}
      <div className="payment-form-section">
        <h3>Select Vendor</h3>
        <div className="form-group">
          <label>Vendor:</label>
          <select
            value={selectedVendor}
            onChange={(e) => handleVendorChange(e.target.value)}
            className="form-control"
            disabled={vendorsLoading}
          >
            <option value="">
              {vendorsLoading ? 'Loading vendors...' : 
               vendors.length === 0 ? 'No vendors found' : 'Select Vendor'}
            </option>
            {vendors.map(vendor => {
              // Handle both string array and object array formats
              const vendorName = typeof vendor === 'string' ? vendor : vendor.name;
              return (
                <option key={vendorName} value={vendorName}>{vendorName}</option>
              );
            })}
          </select>
        </div>
        {!vendorsLoading && vendors.length === 0 && (
          <p className="no-vendors-message">
            ⚠️ No vendors found. Please add vendors first in the Vendor Management section.
          </p>
        )}
      </div>

      {/* All Wires Payment Data */}
      {selectedVendor && allWiresData.length > 0 && (
        <div className="all-wires-section">
          <h3>💎 Payment Details - {selectedVendor}</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>📊 Data from MongoDB Database</p>
          
          {/* Wires Summary Table */}
          <div className="wires-table-container">
            <table className="wires-summary-table">
              <thead>
                <tr>
                  <th>Wire</th>
                  <th>Payal Design</th>
                  <th>Weight (kg)</th>
                  <th>Total Payable</th>
                </tr>
              </thead>
              <tbody>
                {allWiresData.map((wireData) => {
                  const payalTotals = calculateWirePayalTotals(wireData.wireName, wireData.payalTypes);
                  const wireTotalPayable = Object.values(payalTotals).reduce((sum, p) => sum + p.totalPayable, 0);
                  
                  // Calculate total weight for this wire (IN transactions only)
                  const wireTotalWeight = Object.values(wireData.payalTypes).reduce((sum, payalInfo) => {
                    return sum + parseFloat(payalInfo.totalIn || 0);
                  }, 0);
                  
                  return (
                    <tr key={wireData.wireName} className="wire-row">
                      <td><strong>{wireData.wireName}</strong></td>
                      <td>
                        {Object.keys(payalTotals).join(', ')}
                      </td>
                      <td><strong>{wireTotalWeight.toFixed(2)} kg</strong></td>
                      <td><strong>₹{wireTotalPayable.toFixed(2)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
              {/* <tfoot>
                <tr className="grand-total-row">
                  <td><strong>Grand Total</strong></td>
                  <td></td>
                  <td><strong>₹{allWiresData.reduce((sum, w) => {
                    const payalTotals = calculateWirePayalTotals(w.wireName, w.payalTypes);
                    return sum + Object.values(payalTotals).reduce((s, p) => s + p.totalPayable, 0);
                  }, 0).toFixed(2)}</strong></td>
                  <td><strong>₹{allWiresData.reduce((sum, w) => {
                    const payalTotals = calculateWirePayalTotals(w.wireName, w.payalTypes);
                    return sum + Object.values(payalTotals).reduce((s, p) => s + p.totalPaid, 0);
                  }, 0).toFixed(2)}</strong></td>
                  <td><strong>₹{allWiresData.reduce((sum, w) => {
                    const payalTotals = calculateWirePayalTotals(w.wireName, w.payalTypes);
                    return sum + Object.values(payalTotals).reduce((s, p) => s + p.remainingBalance, 0);
                  }, 0).toFixed(2)}</strong></td>
                </tr>
              </tfoot> */}
            </table>
          </div>
          
          {/* Payment Form Section */}
          <div className="payment-input-section">
            <h4>💳 Record Payment Against Grand Total</h4>
            <div className="grand-total-display" style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '15px 20px',
              borderRadius: '10px',
              marginBottom: '20px',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
            }}>
              <div className="total-info">
                <span className="label" style={{ fontSize: '14px', opacity: 0.9 }}>Maximum Payable Amount:</span>
                <span className="amount" style={{ 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  marginLeft: '15px',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>₹{(() => {
                  const totalPayable = allWiresData.reduce((sum, w) => {
                    const payalTotals = calculateWirePayalTotals(w.wireName, w.payalTypes);
                    return sum + Object.values(payalTotals).reduce((s, p) => s + p.totalPayable, 0);
                  }, 0);
                  const totalPaid = payments
                    .filter(p => p.vendor === selectedVendor)
                    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                  return (totalPayable - totalPaid).toFixed(2);
                })()}</span>
              </div>
              <div style={{ fontSize: '12px', opacity: 0.85, textAlign: 'right' }}>
                ⚠️ Payment cannot exceed this amount
              </div>
            </div>
            <form onSubmit={handlePaymentSubmit} className="payment-input-form">
              <div className="payment-input-grid-simple">
                <div className="form-group">
                  <label>Payment Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="form-control"
                    placeholder="Enter payment amount"
                    max={(() => {
                      const totalPayable = allWiresData.reduce((sum, w) => {
                        const payalTotals = calculateWirePayalTotals(w.wireName, w.payalTypes);
                        return sum + Object.values(payalTotals).reduce((s, p) => s + p.totalPayable, 0);
                      }, 0);
                      const totalPaid = payments
                        .filter(p => p.vendor === selectedVendor)
                        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                      return (totalPayable - totalPaid).toFixed(2);
                    })()}
                    required
                  />
                  {paymentForm.amount && parseFloat(paymentForm.amount) > (() => {
                    const totalPayable = allWiresData.reduce((sum, w) => {
                      const payalTotals = calculateWirePayalTotals(w.wireName, w.payalTypes);
                      return sum + Object.values(payalTotals).reduce((s, p) => s + p.totalPayable, 0);
                    }, 0);
                    const totalPaid = payments
                      .filter(p => p.vendor === selectedVendor)
                      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                    return totalPayable - totalPaid;
                  })() && (
                    <div style={{
                      color: '#dc3545',
                      fontSize: '12px',
                      marginTop: '5px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      ⚠️ Amount exceeds remaining balance!
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Notes (Optional)</label>
                  <input
                    type="text"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="form-control"
                    placeholder="Payment notes"
                  />
                </div>

                <div className="form-group submit-group">
                  <button type="submit" className="payment-submit-btn-new">
                    💰 Record Payment
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Summary Section */}
      {selectedVendor && allWiresData.length > 0 && (
        <div className="payment-summary-section">
          <h3>💰 Payment Summary - {selectedVendor}</h3>
          <div className="summary-cards">
            <div className="summary-card total-payable-card">
              <div className="card-icon">📊</div>
              <div className="card-content">
                <span className="card-label">Total Payable</span>
                <span className="card-amount">₹{allWiresData.reduce((sum, w) => {
                  const payalTotals = calculateWirePayalTotals(w.wireName, w.payalTypes);
                  return sum + Object.values(payalTotals).reduce((s, p) => s + p.totalPayable, 0);
                }, 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="summary-card total-paid-card">
              <div className="card-icon">✅</div>
              <div className="card-content">
                <span className="card-label">Total Paid</span>
                <span className="card-amount">₹{payments
                  .filter(p => p.vendor === selectedVendor)
                  .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
                  .toFixed(2)}</span>
              </div>
            </div>

            <div className="summary-card remaining-card">
              <div className="card-icon">⚠️</div>
              <div className="card-content">
                <span className="card-label">Remaining Balance</span>
                <span className="card-amount remaining">₹{(() => {
                  const totalPayable = allWiresData.reduce((sum, w) => {
                    const payalTotals = calculateWirePayalTotals(w.wireName, w.payalTypes);
                    return sum + Object.values(payalTotals).reduce((s, p) => s + p.totalPayable, 0);
                  }, 0);
                  const totalPaid = payments
                    .filter(p => p.vendor === selectedVendor)
                    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                  return (totalPayable - totalPaid).toFixed(2);
                })()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Section */}
      {selectedVendor && payments.filter(p => p.vendor === selectedVendor).length > 0 && (
        <div className="payment-history-section">
          <h3>📜 Payment History - {selectedVendor}</h3>
          <div className="payment-history-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount Paid</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments
                  .filter(p => p.vendor === selectedVendor)
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((payment, index) => (
                    <tr key={payment.id || index}>
                      <td>{new Date(payment.date).toLocaleDateString('en-IN')}</td>
                      <td className="amount-cell">₹{parseFloat(payment.amount).toFixed(2)}</td>
                      <td>{payment.notes || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {selectedVendor && allWiresData.length === 0 && !loading && (
        <div className="no-data-message">
          <h3>⚠️ No Payment Data Available</h3>
          <p>No valid IN transactions found for <strong>{selectedVendor}</strong>.</p>
          <div className="requirements-info">
            <h4>📋 Common Issues & Solutions:</h4>
            <ul>
              <li>🔍 <strong>Unknown PayalType:</strong> Transactions with "Unknown" payalType are skipped</li>
              <li>✅ <strong>Valid PayalTypes:</strong> Moorni, Silver, Golden, Diamond only</li>
              <li>📊 <strong>Vendor Assignment:</strong> Vendor must have assigned wire-payal combinations</li>
              <li>💾 <strong>Database Storage:</strong> Check if vendor data is properly stored in MongoDB</li>
              <li>🔧 <strong>Transaction Data:</strong> Verify wireThickness and payalType fields</li>
            </ul>
          </div>
          <div className="next-steps">
            <h4>🔧 Troubleshooting Steps:</h4>
            <p>1. Check browser console for "Skipping transaction" warnings</p>
            <p>2. Verify vendor has assigned wires in Vendor Management</p>
            <p>3. Ensure transactions have valid payalType (not "Unknown")</p>
            <p>4. Run database test: <code>node test-vendor-creation.js</code></p>
          </div>
        </div>
      )}

      {/* Payment Form */}
      {paymentForm.wire && paymentForm.payalType && (
        <div className="payment-form-section">
          <h3>💰 Record Payment</h3>
          <div className="payment-context">
            <div className="context-info">
              <span>Vendor: <strong>{selectedVendor}</strong></span>
              <span>Wire: <strong>{paymentForm.wire}</strong></span>
              <span>Payal Type: <strong>{paymentForm.payalType}</strong></span>
              {(() => {
                const wireData = allWiresData.find(w => w.wireName === paymentForm.wire);
                if (wireData) {
                  const payalTotals = calculateWirePayalTotals(wireData.wireName, wireData.payalTypes);
                  const payalData = payalTotals[paymentForm.payalType];
                  if (payalData) {
                    return <span>Remaining Balance: <strong>₹{payalData.remainingBalance.toFixed(2)}</strong></span>;
                  }
                }
                return null;
              })()}
            </div>
          </div>
          <form onSubmit={handlePaymentSubmit}>
            <div className="payment-form-grid">
              <div className="form-group">
                <label>Wire:</label>
                <input
                  type="text"
                  value={paymentForm.wire}
                  readOnly
                  className="form-control readonly"
                />
              </div>
              <div className="form-group">
                <label>Payal Design:</label>
                <input
                  type="text"
                  value={paymentForm.payalType}
                  readOnly
                  className="form-control readonly"
                />
              </div>
              <div className="form-group">
                <label>Payment Amount (₹):</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="form-control"
                  placeholder="Enter amount"
                  required
                />
                {(() => {
                  const wireData = allWiresData.find(w => w.wireName === paymentForm.wire);
                  if (wireData) {
                    const payalTotals = calculateWirePayalTotals(wireData.wireName, wireData.payalTypes);
                    const payalData = payalTotals[paymentForm.payalType];
                    if (payalData && payalData.remainingBalance > 0) {
                      return (
                        <div className="payment-suggestions">
                          <button 
                            type="button" 
                            className="suggestion-btn"
                            onClick={() => setPaymentForm({ 
                              ...paymentForm, 
                              amount: payalData.remainingBalance.toFixed(2) 
                            })}
                          >
                            Pay Full Balance (₹{payalData.remainingBalance.toFixed(2)})
                          </button>
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
              </div>
              <div className="form-group">
                <label>Payment Date:</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label>Notes (Optional):</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="form-control"
                  placeholder="Payment notes"
                />
              </div>
            </div>
            <button type="submit" className="payment-submit-btn">
              💳 Record Payment
            </button>
          </form>
        </div>
      )}

      {/* Payment History */}
      {/* {selectedVendor && (
        <div className="payment-history-section">
          <h3>📋 Payment History</h3>
          <div className="payment-history-table">
            {payments.filter(p => p.vendor === selectedVendor).length === 0 ? (
              <p className="no-payments">No payments recorded for this vendor yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Wire</th>
                    <th>Payal Design</th>
                    <th>Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {payments
                    .filter(p => p.vendor === selectedVendor)
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(payment => (
                      <tr key={payment.id}>
                        <td>{new Date(payment.date).toLocaleDateString()}</td>
                        <td>{payment.wire}</td>
                        <td>{payment.payalType}</td>
                        <td>₹{payment.amount.toFixed(2)}</td>
                        <td>{payment.notes || '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )} */}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Loading...</div>
        </div>
      )}

      {/* Fixed Screenshot Button */}
      <button 
        onClick={takeScreenshot}
        className="screenshot-btn"
        title="Take Screenshot"
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
          zIndex: 1000,
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.1)';
          e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        }}
      >
        📸
      </button>
    </div>
  )
}
export default Payment;
