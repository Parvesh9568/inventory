import { useEffect } from 'react';

const InPanel = ({ 
  inItems, 
  inForm, 
  handleFormChange, 
  addItem, 
  deleteItem, 
  vendors, 
  items,
  availableInventory,
  priceChart,
  onDataUpdate 
}) => {
  const totalIn = inItems.reduce((sum, item) => sum + item.total, 0);

  // Auto-refresh data when vendors change (e.g., when wire assignments are updated)
  useEffect(() => {
    // This effect will run when vendors array changes
  }, [vendors]);

  // Get unique vendors that have available inventory
  const availableVendors = [...new Set(availableInventory.map(item => item.vendor))];
  
  // Get selected vendor object to access assigned wires
  const selectedVendorObj = vendors.find(v => v.name === inForm.vendor);
  
  // Get available items for selected vendor - only show wires assigned to this vendor
  const availableItemsForVendor = inForm.vendor && selectedVendorObj?.assignedWires
    ? [...new Set(selectedVendorObj.assignedWires.map(wire => wire.wireName))]
    : inForm.vendor 
      ? availableInventory
          .filter(item => item.vendor === inForm.vendor)
          .map(item => item.item)
      : [];
  
  // Get available payal types for selected wire from vendor's assigned wires ONLY
  const getAvailablePayalTypes = () => {
    if (!inForm.item || !selectedVendorObj?.assignedWires) {
      return [];
    }
    
    // Get payal types from vendor's assigned wires for the selected item
    const vendorWireAssignments = selectedVendorObj.assignedWires.filter(
      wire => wire.wireName === inForm.item
    );
    
    // Only return vendor-specific payal types, no fallback to general price chart
    return vendorWireAssignments.map(wire => wire.payalType);
  };
  
  const availablePayalTypes = getAvailablePayalTypes();

  // Get vendor-specific price for selected wire and payal type ONLY
  const getVendorSpecificPrice = () => {
    if (!inForm.item || !inForm.payalType || !selectedVendorObj?.assignedWires) {
      return 0;
    }
    
    const vendorWireAssignment = selectedVendorObj.assignedWires.find(
      wire => wire.wireName === inForm.item && wire.payalType === inForm.payalType
    );
    
    // Only return vendor-assigned price, no fallback to general price chart
    return vendorWireAssignment ? vendorWireAssignment.pricePerKg : 0;
  };

  const vendorSpecificPrice = getVendorSpecificPrice();

  // Determine whether the Add button should be enabled
  const canAddInItem = !!(
    inForm.vendor &&
    inForm.item &&
    inForm.payalType &&
    inForm.weight &&
    Number(inForm.weight) > 0 &&
    inForm.price !== '' &&
    !isNaN(Number(inForm.price))
  );

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{color: '#10ac84', margin: 0}}>🟢 IN - Import Items</h2>
        <button 
          onClick={() => {
            if (onDataUpdate) {
              onDataUpdate();
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#10ac84',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          🔄 Refresh Data
        </button>
      </div>
      
      {availableInventory.length === 0 && (
        <div className="inventory-warning">
          <p>⚠️ No items available for import. Please export items first in the OUT panel.</p>
        </div>
      )}
      
      <div className="form-section">
        <select 
          value={inForm.vendor} 
          onChange={(e) => handleFormChange('in', 'vendor', e.target.value)}
          disabled={availableInventory.length === 0}
        >
          <option value="">Select Vendor</option>
          {availableVendors.map(vendor => (
            <option key={vendor} value={vendor}>{vendor}</option>
          ))}
        </select>

        <select 
          value={inForm.item} 
          onChange={(e) => handleFormChange('in', 'item', e.target.value)}
          disabled={!inForm.vendor}
        >
          <option value="">
            {!inForm.vendor ? 'Select Vendor First' : 'Select Wire Thickness'}
          </option>
          {availableItemsForVendor.map(item => (
            <option key={item} value={item}>{item}</option>
          ))}
          {availableItemsForVendor.length === 0 && inForm.vendor && (
            <option value="" disabled>
              No wires assigned to this vendor
            </option>
          )}
        </select>

        <select 
          value={inForm.payalType || ''} 
          onChange={(e) => handleFormChange('in', 'payalType', e.target.value)}
          disabled={!inForm.item}
        >
          <option value="">
            {!inForm.item ? 'Select Wire First' : 'Select Payal Type'}
          </option>
          {availablePayalTypes.map(payalType => (
            <option key={payalType} value={payalType}>
              {payalType === 'Moorni' ? '🔷 Moorni' :
               payalType === 'Silver' ? '⚪ Silver' :
               payalType === 'Golden' ? '🟡 Golden' :
               payalType === 'Diamond' ? '💎 Diamond' : `💎 ${payalType}`} Payal
            </option>
          ))}
          {availablePayalTypes.length === 0 && inForm.item && (
            <option value="" disabled>
              {selectedVendorObj?.assignedWires?.length === 0 
                ? 'No wires assigned to this vendor' 
                : 'No payal types available for this wire'}
            </option>
          )}
        </select>

        <input 
          type="number" 
          value={inForm.weight || ''}
          onChange={(e) => handleFormChange('in', 'weight', e.target.value)}
          placeholder="Weight (kg)"
          step="0.01"
          min="0"
        />

        <input 
          type="date" 
          value={inForm.inDate || ''}
          onChange={(e) => handleFormChange('in', 'inDate', e.target.value)}
          title="IN Date"
        />

        <input 
          type="number" 
          value={inForm.price}
          onChange={(e) => handleFormChange('in', 'price', e.target.value)}
          placeholder={vendorSpecificPrice > 0 ? `Auto-calculated: ₹${(vendorSpecificPrice * (inForm.weight || 0)).toFixed(2)}` : "Enter total price"}
          step="0.01"
          disabled={!inForm.vendor || !inForm.item}
        />
        
        {/* Auto-calculate button for vendor-specific pricing */}
        {vendorSpecificPrice > 0 && inForm.weight && (
          <button 
            type="button"
            onClick={() => {
              const calculatedPrice = (vendorSpecificPrice * parseFloat(inForm.weight)).toFixed(2);
              handleFormChange('in', 'price', calculatedPrice);
            }}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              backgroundColor: '#10ac84',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            💰 Auto-Calculate (₹{vendorSpecificPrice}/kg)
          </button>
        )}
        
        {/* Debug message when no price is found */}
        {/* {inForm.vendor && inForm.item && inForm.payalType && vendorSpecificPrice === 0 && (
          <div style={{
            marginTop: '10px',
            padding: '8px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#856404'
          }}>
            ⚠️ No price found for {inForm.vendor} → {inForm.item} → {inForm.payalType}. 
            Please assign this wire-payal combination to the vendor first.
          </div>
        )} */}

        <button 
          className="add-btn" 
          onClick={async () => {
            await addItem('in');
            // Refresh data after adding item to update inventory
            if (onDataUpdate) {
              await onDataUpdate();
            }
          }}
          disabled={availableInventory.length === 0 || !canAddInItem}
        >
          ➕ Add
        </button>

        {/* Inline validation hint when fields are missing */}
        {!canAddInItem && (
          <div className="form-hint" style={{color: '#c0392b', marginTop: '8px'}}>
            ⚠️ Please fill all fields: Vendor, Wire Thickness, Payal Type, Weight (&gt; 0) and Price.
          </div>
        )}
        
        {/* Warning when vendor has no assigned wires */}
        {inForm.vendor && selectedVendorObj && (!selectedVendorObj.assignedWires || selectedVendorObj.assignedWires.length === 0) && (
          <div style={{
            marginTop: '15px',
            padding: '12px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '8px',
            color: '#856404'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span>⚠️</span>
              <strong>No Wire Assignments Found</strong>
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
              Vendor "{inForm.vendor}" has no assigned wires with specific pricing. 
              Please assign wires to this vendor first to proceed with transactions.
            </p>
            <p style={{ margin: '0', fontSize: '12px', fontStyle: 'italic' }}>
              💡 Go to Vendor Management → Click "🔧 Assign Wire" button → Select wire, payal type, and set custom price.
            </p>
          </div>
        )}
        
        {/* Show assigned wires for selected vendor */}
        {inForm.vendor && selectedVendorObj?.assignedWires && selectedVendorObj.assignedWires.length > 0 && (
          <div style={{
            marginTop: '15px',
            padding: '12px',
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '8px',
            color: '#155724'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span>✅</span>
              <strong>Available Wire Assignments for {inForm.vendor}</strong>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedVendorObj.assignedWires.map((wire, index) => (
                <div key={index} style={{
                  padding: '4px 8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #28a745',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  <span style={{ color: '#667eea' }}>{wire.wireName}</span>
                  <span style={{ margin: '0 4px', opacity: 0.6 }}>•</span>
                  <span style={{ color: '#666' }}>
                    {wire.payalType === 'Moorni' ? '🔷 Moorni' :
                     wire.payalType === 'Silver' ? '⚪ Silver' :
                     wire.payalType === 'Golden' ? '🟡 Golden' :
                     wire.payalType === 'Diamond' ? '💎 Diamond' : `💎 ${wire.payalType}`}
                  </span>
                  <span style={{ margin: '0 4px', opacity: 0.6 }}>•</span>
                  <span style={{ color: '#10ac84' }}>₹{wire.pricePerKg}/kg</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Vendor-Specific Price Calculator Display */}
      {inForm.item && inForm.payalType && inForm.weight && inForm.price && (
        <div className="payal-calculator">
          <h4>💎 {inForm.vendor} - {inForm.payalType} Payal Price Calculator</h4>
          <div className="calculation-display">
            <div className="calc-info">
              <span className="calc-label">Vendor:</span>
              <span className="calc-value">{inForm.vendor}</span>
            </div>
            <div className="calc-info">
              <span className="calc-label">Wire Thickness:</span>
              <span className="calc-value">{inForm.item}</span>
            </div>
            <div className="calc-info">
              <span className="calc-label">Payal Type:</span>
              <span className="calc-value">{inForm.payalType}</span>
            </div>
            <div className="calc-info">
              <span className="calc-label">Weight:</span>
              <span className="calc-value">{inForm.weight} kg</span>
            </div>
            {vendorSpecificPrice > 0 && (
              <div className="calc-info">
                <span className="calc-label">Vendor-Assigned Price:</span>
                <span className="calc-value">₹{vendorSpecificPrice} per kg</span>
              </div>
            )}
            <div className="calc-info">
              <span className="calc-label">Calculated Total:</span>
              <span className="calc-value">₹{(vendorSpecificPrice * parseFloat(inForm.weight || 0)).toFixed(2)}</span>
            </div>
            <div className="calc-info total">
              <span className="calc-label"><strong>Vendor Payable:</strong></span>
              <span className="calc-value total"><strong>₹{inForm.price}</strong></span>
            </div>
            {parseFloat(inForm.price) !== (vendorSpecificPrice * parseFloat(inForm.weight || 0)) && (
              <div className="calc-info" style={{color: '#e67e22'}}>
                <span className="calc-label">⚠️ Custom Price:</span>
                <span className="calc-value">Different from calculated price</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Available Inventory Display */}
      {inForm.vendor && inForm.item && (
        <div className="inventory-status">
          {(() => {
            const availableItem = availableInventory.find(
              item => item.vendor === inForm.vendor && item.item === inForm.item
            );
            if (!availableItem) {
              // Add a button to jump to OUT panel with vendor/item pre-filled
              const goToOutPanel = () => {
                // Store prefill info in sessionStorage (or use a global state/store if available)
                sessionStorage.setItem('prefillOutVendor', inForm.vendor);
                sessionStorage.setItem('prefillOutItem', inForm.item);
                window.location.href = '/out';
              };
              return (
                <div className="available-qty" style={{color: '#c0392b'}}>
                  <div>❌ Item "{inForm.item}" from "{inForm.vendor}" is not available for import. Please export it first.</div>
                  <button style={{marginTop: '8px'}} onClick={goToOutPanel}>
                    Go to OUT panel to export
                  </button>
                </div>
              );
            }
            const availableWeight = availableItem ? (availableItem.totalOut - availableItem.totalIn) : 0;
            return (
              <p className="available-qty">
                📦 Available for import: <strong>{availableWeight} kg</strong> of {inForm.item} from {inForm.vendor}
              </p>
            );
          })()}
        </div>
      )}

      {/* Current Inventory Status Table */}
      {availableInventory.length > 0 && (
        <div className="inventory-overview">
          <h3>📋 Available Inventory</h3>
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Wire</th>
                <th>Total OUT</th>
                <th>Total IN</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {availableInventory.map((item, i) => (
                <tr key={i}>
                  <td>{item.vendor}</td>
                  <td>{item.item}</td>
                  <td>{item.totalOut}</td>
                  <td>{item.totalIn}</td>
                  <td className="available-cell">{item.totalOut - item.totalIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <table>
        <thead>
          <tr><th>Sr.No</th><th>IN Date</th><th>Vendor</th><th>Wire</th><th>Payal Type 💎</th><th>Weight (kg)</th><th>Vendor Payable</th><th>Action</th></tr>
        </thead>
        <tbody>
          {inItems.map((item, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {/* <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</td> */}
              <td>{item.inDate ? new Date(item.inDate).toLocaleDateString('en-GB') : '-'}</td>
              <td>{item.vendor}</td>
              <td>{item.item}</td>
              <td>
                <span className="payal-type" style={{ 
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: item.payalType === 'Moorni' ? '#e1f5fe' :
                                 item.payalType === 'Silver' ? '#f5f5f5' :
                                 item.payalType === 'Golden' ? '#fff3e0' :
                                 item.payalType === 'Diamond' ? '#e8f5e9' : 'transparent',
                  color: '#333',
                  fontWeight: '500'
                }}>
                  {item.payalType === 'Moorni' ? '🔷' :
                   item.payalType === 'Silver' ? '⚪' :
                   item.payalType === 'Golden' ? '🟡' :
                   item.payalType === 'Diamond' ? '💎' : ''} {item.payalType}
                </span>
              </td>
              <td>{item.qty}</td>
              <td>₹{item.price ? item.price.toFixed(2) : item.total.toFixed(2)}</td>
              <td>
                <button 
                  className="delete-btn" 
                  onClick={async () => {
                    await deleteItem('in', i);
                    // Refresh data after deleting item to update inventory
                    if (onDataUpdate) {
                      await onDataUpdate();
                    }
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* <div className="summary">Total IN Value: ₹{totalIn.toFixed(2)}</div> */}
    </div>
  );
};

export default InPanel;
