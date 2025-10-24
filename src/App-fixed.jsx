import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InPanel from './components/InPanel';
import OutPanel from './components/OutPanel';
import DataManagement from './components/DataManagement';
import VendorManagement from './components/VendorManagement';
import SearchVendorSection from './SearchVendorSection';
import Payment from './components/Payment';
import apiService from './services/api';

function App() {
  // State for loading and error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for IN and OUT items
  const [inItems, setInItems] = useState([]);
  const [outItems, setOutItems] = useState([]);

  // State for vendors and items data
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [vendorPrices, setVendorPrices] = useState({});
  const [priceChart, setPriceChart] = useState({});

  // Form states for IN panel
  const [inForm, setInForm] = useState({
    vendor: '',
    item: '', // This will be wire thickness (22mm, 28mm, 30mm, 32mm)
    payalType: '', // Moorni, Silver, Golden, Diamond
    weight: '', // Weight in kg (replaces qty)
    price: '',
    inDate: new Date().toISOString().split('T')[0] // Default to today
  });

  // Form states for OUT panel
  const [outForm, setOutForm] = useState({
    vendor: '',
    item: '',
    weight: '', // Weight in kg (replaces qty)
    outDate: new Date().toISOString().split('T')[0] // Default to today
  });

  // Calculate Moorni Payal price
  const calculatePayalPrice = (wireThickness, payalType, weight) => {
    if (wireThickness && payalType && weight && priceChart[wireThickness] && priceChart[wireThickness][payalType]) {
      const basePrice = priceChart[wireThickness][payalType];
      const totalPrice = basePrice * parseFloat(weight);
      return totalPrice.toFixed(2);
    }
    return '';
  };

  // Update price when vendor or item changes
  const updatePrice = (type, vendor, item) => {
    if (vendor && item && vendorPrices[vendor] && vendorPrices[vendor][item]) {
      const price = vendorPrices[vendor][item];
      if (type === 'in') {
        setInForm(prev => ({ ...prev, price: price }));
      } else {
        setOutForm(prev => ({ ...prev, price: price }));
      }
    } else {
      if (type === 'in') {
        setInForm(prev => ({ ...prev, price: '' }));
      } else {
        setOutForm(prev => ({ ...prev, price: '' }));
      }
    }
  };

  // Handle form input changes
  const handleFormChange = (type, field, value) => {
    if (type === 'in') {
      const newForm = { ...inForm, [field]: value };
      
      // Auto-calculate price for Moorni Payal when wire thickness, payal type, or weight changes
      if (field === 'item' || field === 'payalType' || field === 'weight') {
        const wireThickness = field === 'item' ? value : newForm.item;
        const payalType = field === 'payalType' ? value : newForm.payalType;
        const weight = field === 'weight' ? value : newForm.weight;
        
        const calculatedPrice = calculatePayalPrice(wireThickness, payalType, weight);
        newForm.price = calculatedPrice;
      }
      
      setInForm(newForm);
    } else {
      setOutForm(prev => ({ ...prev, [field]: value }));
    }
  };

  // Calculate available inventory for IN operations
  const getAvailableInventory = () => {
    const inventory = {};
    
    // Add all OUT items to inventory
    outItems.forEach(item => {
      const key = `${item.vendor}-${item.item}`;
      if (!inventory[key]) {
        inventory[key] = {
          vendor: item.vendor,
          item: item.item,
          totalOut: 0,
          totalIn: 0
        };
      }
      inventory[key].totalOut += (item.weight || item.qty || 0);
    });
    
    // Subtract all IN items from inventory
    inItems.forEach(item => {
      const key = `${item.vendor}-${item.item}`;
      if (inventory[key]) {
        inventory[key].totalIn += (item.weight || item.qty || 0);
      }
    });
    
    // Return only items with available weight (OUT > IN)
    return Object.values(inventory).filter(item => 
      (item.totalOut - item.totalIn) > 0
    );
  };

  // Check if item is available for IN operation
  const checkItemAvailability = (vendor, item, requestedWeight) => {
    const key = `${vendor}-${item}`;
    const inventory = getAvailableInventory();
    const availableItem = inventory.find(inv => 
      inv.vendor === vendor && inv.item === item
    );
    
    if (!availableItem) {
      return {
        available: false,
        message: `❌ Item "${item}" from "${vendor}" is not available for import. Please export it first.`
      };
    }
    
    const availableWeight = availableItem.totalOut - availableItem.totalIn;
    if (requestedWeight > availableWeight) {
      return {
        available: false,
        message: `❌ Only ${availableWeight} kg of "${item}" from "${vendor}" are available for import. You requested ${requestedWeight} kg.`
      };
    }
    
    return { available: true };
  };

  // Refresh transaction data function
  const refreshTransactionData = async () => {
    try {
      const [inTransactions, outTransactions] = await Promise.all([
        apiService.getTransactionsByType('IN'),
        apiService.getTransactionsByType('OUT')
      ]);
      
      setInItems(inTransactions);
      setOutItems(outTransactions);
    } catch (error) {
      // Failed to refresh transaction data
    }
  };

  // Add item to list with inventory validation
  const addItem = async (type) => {
    const form = type === 'in' ? inForm : outForm;
    
    if (type === 'in') {
      const { vendor, item, payalType, weight, price } = form;
      
      // Validate required fields
      if (!vendor || !item || !payalType || !weight || weight <= 0 || !price || isNaN(price)) {
        alert('⚠️ Please fill all fields properly (Vendor, Wire Thickness, Payal Type, Weight, Price).');
        return;
      }

      // Client-side existence check: if vendor or item is missing, offer to create them
      const missingVendor = !vendors.find(v => v.name === vendor);
      const missingItem = !items.includes(item);

      if (missingVendor || missingItem) {
        try {
          // Ask user whether to create missing resources
          if (missingVendor) {
            const createVendor = window.confirm(`Vendor "${vendor}" not found. Create it now?`);
            if (createVendor) {
              await apiService.addVendor(vendor);
              const vendorsData = await apiService.getAllVendors();
              setVendors(vendorsData); // Store full vendor objects
            } else {
              return; // user declined
            }
          }

          if (missingItem) {
            const createItem = window.confirm(`Item "${item}" not found. Create it now?`);
            if (createItem) {
              await apiService.addItem(item);
              const itemsData = await apiService.getAllItems();
              setItems(itemsData.map(i => i.name));
            } else {
              return; // user declined
            }
          }
        } catch (err) {
          alert(`❌ Failed to create missing resource: ${err.message}`);
          return;
        }
      }

      // Client-side inventory check before calling backend
      const avail = checkItemAvailability(vendor, item, parseFloat(weight));
      if (!avail.available) {
        alert(avail.message);
        return;
      }

      try {
        // Send to API with Moorni Payal data
        const transactionData = {
          type: type.toUpperCase(),
          vendor,
          item: item,
          qty: parseFloat(weight),
          price: parseFloat(price),
          weight: parseFloat(weight),
          payalType: payalType, // Explicitly include payalType
          wireThickness: item,
          total: parseFloat(price),
          inDate: form.inDate // Include the IN date
        };

        const newTransaction = await apiService.addTransaction(transactionData);

        // Update local state
        setInItems(prev => {
          const newItems = [...prev, newTransaction];
          return newItems;
        });
        setInForm({ vendor: '', item: '', payalType: '', weight: '', price: '', inDate: new Date().toISOString().split('T')[0] });

        // Refresh data to update OutPanel inventory
        await refreshTransactionData();

      } catch (error) {
        alert(`❌ ${error.message}`);
      }
    } else {
      const { vendor, item, weight } = form;
      
      if (!vendor || !item || !weight || weight <= 0) {
        alert('⚠️ Please fill all fields properly (Vendor, Item, Weight).');
        return;
      }

      // Use default price of 0 for OUT transactions
      const defaultPrice = 0;

      try {
        // Send to API
        const transactionData = {
          type: type.toUpperCase(),
          vendor,
          item,
          qty: parseFloat(weight), // Use weight as quantity
          price: defaultPrice,
          weight: parseFloat(weight),
          total: defaultPrice * parseFloat(weight),
          outDate: form.outDate // Include the OUT date
        };

        const newTransaction = await apiService.addTransaction(transactionData);

        // Update local state
        setOutItems(prev => [...prev, newTransaction]);
        setOutForm({ vendor: '', item: '', weight: '', outDate: new Date().toISOString().split('T')[0] });

        // Refresh data to update InPanel inventory
        await refreshTransactionData();

      } catch (error) {
        alert(`❌ ${error.message}`);
      }
    }
  };

  // Delete item from list
  const deleteItem = async (type, index) => {
    const items = type === 'in' ? inItems : outItems;
    const item = items[index];

    if (!item || !item.id) {
      alert('❌ Cannot delete item: Invalid item data');
      return;
    }

    try {
      await apiService.deleteTransaction(item.id);

      // Update local state
      if (type === 'in') {
        setInItems(prev => prev.filter((_, i) => i !== index));
      } else {
        setOutItems(prev => prev.filter((_, i) => i !== index));
      }

      // Refresh data to update inventory in both panels
      await refreshTransactionData();

    } catch (error) {
      alert(`❌ Failed to delete item: ${error.message}`);
    }
  };

  // Calculate totals
  const totalIn = inItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalOut = outItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const finalTotal = totalIn - totalOut;

  // Load data from API on component mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load vendors, items, prices, price chart, and transactions
      const [vendorsData, itemsData, pricesData, priceChartData, inTransactions, outTransactions] = await Promise.all([
        apiService.getAllVendors(),
        apiService.getAllItems(),
        apiService.getVendorPrices(),
        apiService.getPayalPriceChart(),
        apiService.getTransactionsByType('IN'),
        apiService.getTransactionsByType('OUT')
      ]);

      setVendors(vendorsData); // Store full vendor objects with assignedWires
      setItems(itemsData.map(i => i.name));
      setVendorPrices(pricesData);
      setPriceChart(priceChartData);
      setInItems(inTransactions);
      setOutItems(outTransactions);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <h2>🔄 Loading...</h2>
          <p>Connecting to database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h2>❌ Connection Error</h2>
          <p>{error}</p>
          <button onClick={loadInitialData} className="retry-btn">
            🔄 Retry Connection
          </button>
          <p className="error-hint">
            Make sure the backend server is running on port 4003
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="app-layout">
        <Sidebar />
        
        <div className="main-content">
          <header className="main-header">
            <button 
              className="hamburger-btn-header"
              onClick={() => {
                const sidebar = document.querySelector('.sidebar');
                const mainContent = document.querySelector('.main-content');
                if (sidebar && mainContent) {
                  sidebar.classList.toggle('sidebar-open');
                  mainContent.classList.toggle('sidebar-open');
                }
              }}
              aria-label="Toggle Menu"
            >
              <span className="hamburger-line-header"></span>
              <span className="hamburger-line-header"></span>
              <span className="hamburger-line-header"></span>
            </button>
            <div className="header-left">
              <h1>💼 IN / OUT Management Panel</h1>
            </div>
          </header>
          
          <div className="content-area">
            <Routes>
              <Route 
                path="/" 
                element={<Dashboard inItems={inItems} outItems={outItems} />} 
              />
              <Route 
                path="/out" 
                element={
                  <OutPanel 
                    outItems={outItems}
                    outForm={outForm}
                    handleFormChange={handleFormChange}
                    addItem={addItem}
                    deleteItem={deleteItem}
                    vendors={vendors}
                    items={items}
                  />
                } 
              />
              <Route 
                path="/in" 
                element={
                  <InPanel 
                    inItems={inItems}
                    inForm={inForm}
                    handleFormChange={handleFormChange}
                    addItem={addItem}
                    deleteItem={deleteItem}
                    vendors={vendors}
                    items={items}
                    availableInventory={getAvailableInventory()}
                    priceChart={priceChart}
                  />
                } 
              />
              <Route 
                path="/vendors" 
                element={<VendorManagement onDataUpdate={loadInitialData} />} 
              />
              <Route 
                path="/data" 
                element={<DataManagement onDataUpdate={loadInitialData} />} 
              />
              <Route 
                path="/search" 
                element={<SearchVendorSection inItems={inItems} outItems={outItems} />} 
              />
              <Route 
                path="/payment" 
                element={<Payment />} 
              />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
