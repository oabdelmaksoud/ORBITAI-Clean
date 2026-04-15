/**
 * Unity Inventory System Template
 * Complete item management with equipment, consumables, and UI integration
 */

import type { MechanicsTemplate } from '../../../types/gameMechanics.types.js';

export const UNITY_INVENTORY_SYSTEM_CODE = `using UnityEngine;
using UnityEngine.Events;
using System;
using System.Collections.Generic;
using System.Linq;

[Serializable]
public class InventoryItem
{
    public string {{ITEM_ID}};
    public string {{ITEM_NAME}};
    public string {{DESCRIPTION}};
    public Sprite {{ICON}};
    public ItemType {{TYPE}};
    public int {{QUANTITY}};
    public int {{MAX_STACK_SIZE}} = 99;
    public bool {{IS_STACKABLE}} = true;
    
    public enum ItemType { Consumable, Equipment, Material, Quest, Misc }
}

[Serializable]
public class EquipmentSlot
{
    public EquipmentType {{SLOT_TYPE}};
    public InventoryItem {{EQUIPPED_ITEM}};
    
    public enum EquipmentType { Weapon, Helmet, Chest, Legs, Boots, Accessory }
}

public class InventorySystem : MonoBehaviour
{
    [Header("Inventory Settings")]
    [SerializeField] private int {{MAX_SLOTS}} = 30;
    [SerializeField] private bool {{ALLOW_AUTO_SORT}} = true;
    
    [Header("Events")]
    public UnityEvent<InventoryItem> {{ON_ITEM_ADDED}};
    public UnityEvent<InventoryItem> {{ON_ITEM_REMOVED}};
    public UnityEvent<InventoryItem, int> {{ON_ITEM_USED}};
    public UnityEvent<EquipmentSlot, InventoryItem> {{ON_ITEM_EQUIPPED}};
    public UnityEvent<EquipmentSlot> {{ON_ITEM_UNEQUIPPED}};
    
    // Storage
    private List<InventoryItem> items = new List<InventoryItem>();
    private Dictionary<EquipmentSlot.EquipmentType, EquipmentSlot> equipment = 
        new Dictionary<EquipmentSlot.EquipmentType, EquipmentSlot>();
    
    // Properties
    public int ItemCount => items.Count;
    public int FreeSlots => {{MAX_SLOTS}} - items.Count(i => !i.{{IS_STACKABLE}});
    public List<InventoryItem> Items => new List<InventoryItem>(items);
    
    void Awake()
    {
        // Initialize equipment slots
        foreach (EquipmentSlot.EquipmentType slotType in Enum.GetValues(typeof(EquipmentSlot.EquipmentType)))
        {
            equipment[slotType] = new EquipmentSlot { {{SLOT_TYPE}} = slotType };
        }
    }
    
    /// <summary>
    /// Add item to inventory
    /// </summary>
    public bool AddItem(InventoryItem item, int quantity = 1)
    {
        if (item == null)
        {
            Debug.LogWarning("Cannot add null item to inventory");
            return false;
        }
        
        // Try to stack with existing items
        if (item.{{IS_STACKABLE}})
        {
            var existingItem = items.FirstOrDefault(i => 
                i.{{ITEM_ID}} == item.{{ITEM_ID}} && 
                i.{{QUANTITY}} < i.{{MAX_STACK_SIZE}}
            );
            
            if (existingItem != null)
            {
                int spaceInStack = existingItem.{{MAX_STACK_SIZE}} - existingItem.{{QUANTITY}};
                int amountToAdd = Mathf.Min(quantity, spaceInStack);
                
                existingItem.{{QUANTITY}} += amountToAdd;
                quantity -= amountToAdd;
                
                {{ON_ITEM_ADDED}}?.Invoke(existingItem);
                
                // If still have items left, try to add to new slot
                if (quantity > 0)
                {
                    return AddItem(item, quantity);
                }
                
                return true;
            }
        }
        
        // Add as new item
        if (items.Count >= {{MAX_SLOTS}})
        {
            Debug.LogWarning("Inventory is full!");
            return false;
        }
        
        var newItem = new InventoryItem
        {
            {{ITEM_ID}} = item.{{ITEM_ID}},
            {{ITEM_NAME}} = item.{{ITEM_NAME}},
            {{DESCRIPTION}} = item.{{DESCRIPTION}},
            {{ICON}} = item.{{ICON}},
            {{TYPE}} = item.{{TYPE}},
            {{QUANTITY}} = quantity,
            {{MAX_STACK_SIZE}} = item.{{MAX_STACK_SIZE}},
            {{IS_STACKABLE}} = item.{{IS_STACKABLE}}
        };
        
        items.Add(newItem);
        {{ON_ITEM_ADDED}}?.Invoke(newItem);
        
        return true;
    }
    
    /// <summary>
    /// Remove item from inventory
    /// </summary>
    public bool RemoveItem(string itemId, int quantity = 1)
    {
        var item = items.FirstOrDefault(i => i.{{ITEM_ID}} == itemId);
        
        if (item == null)
        {
            Debug.LogWarning($"Item {itemId} not found in inventory");
            return false;
        }
        
        if (item.{{QUANTITY}} > quantity)
        {
            item.{{QUANTITY}} -= quantity;
            {{ON_ITEM_REMOVED}}?.Invoke(item);
        }
        else
        {
            items.Remove(item);
            {{ON_ITEM_REMOVED}}?.Invoke(item);
        }
        
        return true;
    }
    
    /// <summary>
    /// Use consumable item
    /// </summary>
    public void UseItem(string itemId, int slot = -1)
    {
        var item = slot >= 0 && slot < items.Count 
            ? items[slot] 
            : items.FirstOrDefault(i => i.{{ITEM_ID}} == itemId);
        
        if (item == null)
        {
            Debug.LogWarning($"Item {itemId} not found");
            return;
        }
        
        if (item.{{TYPE}} == InventoryItem.ItemType.Consumable)
        {
            {{ON_ITEM_USED}}?.Invoke(item, slot);
            RemoveItem(item.{{ITEM_ID}}, 1);
        }
        else
        {
            Debug.LogWarning($"Item {item.{{ITEM_NAME}}} is not consumable");
        }
    }
    
    /// <summary>
    /// Equip item to appropriate slot
    /// </summary>
    public bool EquipItem(string itemId, EquipmentSlot.EquipmentType slotType)
    {
        var item = items.FirstOrDefault(i => i.{{ITEM_ID}} == itemId);
        
        if (item == null || item.{{TYPE}} != InventoryItem.ItemType.Equipment)
        {
            Debug.LogWarning("Item cannot be equipped");
            return false;
        }
        
        var slot = equipment[slotType];
        
        // Unequip current item if exists
        if (slot.{{EQUIPPED_ITEM}} != null)
        {
            UnequipItem(slotType);
        }
        
        // Equip new item
        slot.{{EQUIPPED_ITEM}} = item;
        items.Remove(item);
        
        {{ON_ITEM_EQUIPPED}}?.Invoke(slot, item);
        
        return true;
    }
    
    /// <summary>
    /// Unequip item from slot
    /// </summary>
    public void UnequipItem(EquipmentSlot.EquipmentType slotType)
    {
        var slot = equipment[slotType];
        
        if (slot.{{EQUIPPED_ITEM}} == null)
            return;
        
        // Add back to inventory
        AddItem(slot.{{EQUIPPED_ITEM}});
        
        {{ON_ITEM_UNEQUIPPED}}?.Invoke(slot);
        slot.{{EQUIPPED_ITEM}} = null;
    }
    
    /// <summary>
    /// Get item by ID
    /// </summary>
    public InventoryItem GetItem(string itemId)
    {
        return items.FirstOrDefault(i => i.{{ITEM_ID}} == itemId);
    }
    
    /// <summary>
    /// Check if inventory contains item
    /// </summary>
    public bool HasItem(string itemId, int quantity = 1)
    {
        var totalQuantity = items
            .Where(i => i.{{ITEM_ID}} == itemId)
            .Sum(i => i.{{QUANTITY}});
        
        return totalQuantity >= quantity;
    }
    
    /// <summary>
    /// Get total quantity of item
    /// </summary>
    public int GetItemQuantity(string itemId)
    {
        return items
            .Where(i => i.{{ITEM_ID}} == itemId)
            .Sum(i => i.{{QUANTITY}});
    }
    
    /// <summary>
    /// Sort inventory
    /// </summary>
    public void SortInventory()
    {
        items = items
            .OrderBy(i => i.{{TYPE}})
            .ThenBy(i => i.{{ITEM_NAME}})
            .ToList();
    }
    
    /// <summary>
    /// Clear all items
    /// </summary>
    public void ClearInventory()
    {
        items.Clear();
        
        foreach (var slot in equipment.Values)
        {
            slot.{{EQUIPPED_ITEM}} = null;
        }
    }
    
    /// <summary>
    /// Save inventory data
    /// </summary>
    public InventoryData GetSaveData()
    {
        return new InventoryData
        {
            items = this.items,
            equipment = equipment.Values.ToList()
        };
    }
    
    /// <summary>
    /// Load inventory data
    /// </summary>
    public void LoadSaveData(InventoryData data)
    {
        items = data.items ?? new List<InventoryItem>();
        
        if (data.equipment != null)
        {
            foreach (var slot in data.equipment)
            {
                equipment[slot.{{SLOT_TYPE}}] = slot;
            }
        }
    }
}

[Serializable]
public class InventoryData
{
    public List<InventoryItem> items;
    public List<EquipmentSlot> equipment;
}
`;

export const UNITY_INVENTORY_SYSTEM_CONFIG: MechanicsTemplate = {
    id: 'unity-inventory-system',
    name: 'Unity Inventory System',
    engine: 'unity',
    category: 'progression',
    language: 'csharp',
    code: UNITY_INVENTORY_SYSTEM_CODE,
    variables: [
        { name: 'MAX_SLOTS', type: 'number', default: 30, // @ts-ignore
  description: 'Maximum inventory slots' },
        { name: 'ALLOW_AUTO_SORT', type: 'boolean', default: true, // @ts-ignore
  description: 'Enable auto-sorting' },
        { name: 'ITEM_ID', type: 'string', default: 'itemId', // @ts-ignore
  description: 'Item ID field name' },
        { name: 'ITEM_NAME', type: 'string', default: 'itemName', // @ts-ignore
  description: 'Item name field' },
        { name: 'DESCRIPTION', type: 'string', default: 'description', // @ts-ignore
  description: 'Item description field' },
        { name: 'ICON', type: 'string', default: 'icon', // @ts-ignore
  description: 'Item icon sprite field' },
        { name: 'TYPE', type: 'string', default: 'type', // @ts-ignore
  description: 'Item type field' },
        { name: 'QUANTITY', type: 'string', default: 'quantity', // @ts-ignore
  description: 'Quantity field' },
        { name: 'MAX_STACK_SIZE', type: 'string', default: 'maxStackSize', // @ts-ignore
  description: 'Max stack size field' },
        { name: 'IS_STACKABLE', type: 'string', default: 'isStackable', // @ts-ignore
  description: 'Stackable flag field' },
        { name: 'SLOT_TYPE', type: 'string', default: 'slotType', // @ts-ignore
  description: 'Equipment slot type field' },
        { name: 'EQUIPPED_ITEM', type: 'string', default: 'equippedItem', // @ts-ignore
  description: 'Equipped item field' },
        { name: 'ON_ITEM_ADDED', type: 'string', default: 'onItemAdded', // @ts-ignore
  description: 'Item added event' },
        { name: 'ON_ITEM_REMOVED', type: 'string', default: 'onItemRemoved', // @ts-ignore
  description: 'Item removed event' },
        { name: 'ON_ITEM_USED', type: 'string', default: 'onItemUsed', // @ts-ignore
  description: 'Item used event' },
        { name: 'ON_ITEM_EQUIPPED', type: 'string', default: 'onItemEquipped', // @ts-ignore
  description: 'Item equipped event' },
        { name: 'ON_ITEM_UNEQUIPPED', type: 'string', default: 'onItemUnequipped', // @ts-ignore
  description: 'Item unequipped event' }
    ],
    dependencies: [
        'Unity 2020.3+',
        'System.Linq'
    ],
    instructions: `# Unity Inventory System Setup

## 1. Create Inventory Manager
- Create GameObject: "InventoryManager"
- Add InventorySystem.cs script
- Configure max slots (default: 30)

## 2. Create Item Scriptable Objects
\`\`\`csharp
[CreateAssetMenu(fileName = "New Item", menuName = "Inventory/Item")]
public class ItemData : ScriptableObject
{
    public string itemId;
    public string itemName;
    public string description;
    public Sprite icon;
    public InventoryItem.ItemType type;
    public int maxStackSize = 99;
    public bool isStackable = true;
}
\`\`\`

## 3. Usage Examples
\`\`\`csharp
// Add items
inventory.AddItem(healthPotionItem, 5);
inventory.AddItem(swordItem);

// Check if has item
if (inventory.HasItem("health_potion", 3)) {
    // Player has at least 3 health potions
}

// Use consumable
inventory.UseItem("health_potion");

// Equip item
inventory.EquipItem("iron_sword", EquipmentSlot.EquipmentType.Weapon);

// Get quantity
int potionCount = inventory.GetItemQuantity("health_potion");

// Save/Load
InventoryData save = inventory.GetSaveData();
inventory.LoadSaveData(save);
\`\`\`

## 4. Events
Subscribe to inventory events:
\`\`\`csharp
inventory.onItemAdded.AddListener((item) => {
    Debug.Log($"Added {item.itemName}");
    UpdateUI();
});

inventory.onItemEquipped.AddListener((slot, item) => {
    Debug.Log($"Equipped {item.itemName} to {slot.slotType}");
    UpdatePlayerStats();
});
\`\`\`

## 5. Equipment Slots
Default slots:
- Weapon
- Helmet
- Chest
- Legs
- Boots
- Accessory

Customize in EquipmentSlot.EquipmentType enum.
`,
    // @ts-ignore
  version: '1.0.0',
    tags: ['inventory', 'items', 'equipment', 'rpg', 'progression']
};
