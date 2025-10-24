
import { useEffect } from 'react';

const OutPanel = ({ 
  outItems, 
  outForm, 
  handleFormChange, 
  addItem, 
  deleteItem, 
  vendors, 
  items,
  onDataUpdate 
}) => {
  const totalOut = outItems.reduce((sum, item) => sum + item.total, 0);

  // Get selected vendor object to access assigned wires
  const selectedVendorObj = vendors.find(v => v.name === outForm.vendor);
  
  // Get available wires for selected vendor - only show wires assigned to this vendor
  const availableWiresForVendor = outForm.vendor && selectedVendorObj?.assignedWires
    ? [...new Set(selectedVendorObj.assignedWires.map(wire => wire.wireName))]
    : [];

  // Prefill vendor/item from sessionStorage if present
  useEffect(() => {
    const prefillVendor = sessionStorage.getItem('prefillOutVendor');
    const prefillItem = sessionStorage.getItem('prefillOutItem');
    let changed = false;
    if (prefillVendor && vendors.find(v => v.name === prefillVendor) && outForm.vendor !== prefillVendor) {
      handleFormChange('out', 'vendor', prefillVendor);
      changed = true;
    }
    if (prefillItem && items.includes(prefillItem) && outForm.item !== prefillItem) {
      handleFormChange('out', 'item', prefillItem);
      changed = true;
    }
    if (changed) {
      // Clear prefill after use
      sessionStorage.removeItem('prefillOutVendor');
      sessionStorage.removeItem('prefillOutItem');
    }
  }, [vendors, items]);

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{color: '#ee5253', margin: 0}}>🔴 OUT - Export Items</h2>
        <button 
          onClick={() => {
            if (onDataUpdate) {
              onDataUpdate();
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ee5253',
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
      <div className="form-section">
        <select 
          value={outForm.vendor} 
          onChange={(e) => handleFormChange('out', 'vendor', e.target.value)}
        >
          <option value="">Select Vendor</option>
          {vendors.map(vendor => (
            <option key={vendor.name || vendor} value={vendor.name || vendor}>
              {vendor.name || vendor}
            </option>
          ))}
        </select>

        <select 
          value={outForm.item} 
          onChange={(e) => handleFormChange('out', 'item', e.target.value)}
          disabled={!outForm.vendor}
        >
          <option value="">
            {!outForm.vendor ? 'Select Vendor First' : 'Select Wire'}
          </option>
          {availableWiresForVendor.map(item => (
            <option key={item} value={item}>{item}</option>
          ))}
          {availableWiresForVendor.length === 0 && outForm.vendor && (
            <option value="" disabled>
              No wires assigned to this vendor
            </option>
          )}
        </select>

        <input 
          type="number" 
          value={outForm.weight}
          onChange={(e) => handleFormChange('out', 'weight', e.target.value)}
          placeholder="Weight (kg)"
          step="0.01"
          min="0"
        />

        <input 
          type="date" 
          value={outForm.outDate || ''}
          onChange={(e) => handleFormChange('out', 'outDate', e.target.value)}
          title="OUT Date"
        />

        <button className="add-btn" onClick={() => addItem('out')}>➕ Add</button>
      </div>

      <table>
        <thead>
          <tr><th>Sr.No</th><th>OUT Date</th><th>Vendor</th><th>Wire</th><th>Weight (kg)</th><th>Action</th></tr>
        </thead>
        <tbody>
          {outItems.map((item, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {/* <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</td> */}
              <td>{item.outDate ? new Date(item.outDate).toLocaleDateString('en-GB') : '-'}</td>
              <td>{item.vendor}</td>
              <td>{item.item}</td>
              <td>{item.qty}</td>
              <td>
                <button className="delete-btn" onClick={() => deleteItem('out', i)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* <div className="summary">Total OUT Value: ₹{totalOut.toFixed(2)}</div> */}
    </div>
  );
};

export default OutPanel;
