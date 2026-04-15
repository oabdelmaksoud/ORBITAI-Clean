/**
 * Unity XP & Leveling System Template
 * Complete progression system with experience, levels, and stat scaling
 */

import type { MechanicsTemplate } from '../../../types/gameMechanics.types.js';

export const UNITY_XP_SYSTEM_CODE = `using UnityEngine;
using UnityEngine.Events;
using System;

[Serializable]
public class StatBlock
{
    public float {{MAX_HEALTH}} = 100f;
    public float {{ATTACK_POWER}} = 10f;
    public float {{DEFENSE}} = 5f;
    public float {{MOVE_SPEED}} = 5f;
}

public class XPSystem : MonoBehaviour
{
    [Header("Level Settings")]
    [SerializeField] private int {{STARTING_LEVEL}} = 1;
    [SerializeField] private int {{MAX_LEVEL}} = 50;
    [SerializeField] private float {{BASE_XP_REQUIREMENT}} = 100f;
    [SerializeField] private float {{XP_SCALING_FACTOR}} = 1.5f;
    
    [Header("Stat Scaling")]
    [SerializeField] private StatBlock {{BASE_STATS}};
    [SerializeField] private float {{HEALTH_PER_LEVEL}} = 10f;
    [SerializeField] private float {{ATTACK_PER_LEVEL}} = 2f;
    [SerializeField] private float {{DEFENSE_PER_LEVEL}} = 1f;
    [SerializeField] private float {{SPEED_PER_LEVEL}} = 0.1f;
    
    [Header("Events")]
    public UnityEvent<int> {{ON_LEVEL_UP}};
    public UnityEvent<float, float> {{ON_XP_GAINED}}; // current, required
    
    // Current state
    private int currentLevel;
    private float currentXP;
    private float xpToNextLevel;
    private StatBlock currentStats;
    
    // Properties
    public int CurrentLevel => currentLevel;
    public float CurrentXP => currentXP;
    public float XPToNextLevel => xpToNextLevel;
    public StatBlock CurrentStats => currentStats;
    public float XPProgress => currentXP / xpToNextLevel;
    
    void Awake()
    {
        currentLevel = {{STARTING_LEVEL}};
        currentXP = 0f;
        currentStats = new StatBlock
        {
            {{MAX_HEALTH}} = {{BASE_STATS}}.{{MAX_HEALTH}},
            {{ATTACK_POWER}} = {{BASE_STATS}}.{{ATTACK_POWER}},
            {{DEFENSE}} = {{BASE_STATS}}.{{DEFENSE}},
            {{MOVE_SPEED}} = {{BASE_STATS}}.{{MOVE_SPEED}}
        };
        
        CalculateXPRequirement();
        RecalculateStats();
    }
    
    /// <summary>
    /// Add experience points to the player
    /// </summary>
    public void AddXP(float amount)
    {
        if (currentLevel >= {{MAX_LEVEL}})
            return;
        
        currentXP += amount;
        {{ON_XP_GAINED}}?.Invoke(currentXP, xpToNextLevel);
        
        // Check for level up(s)
        while (currentXP >= xpToNextLevel && currentLevel < {{MAX_LEVEL}})
        {
            LevelUp();
        }
    }
    
    private void LevelUp()
    {
        currentLevel++;
        currentXP -= xpToNextLevel;
        
        CalculateXPRequirement();
        RecalculateStats();
        
        {{ON_LEVEL_UP}}?.Invoke(currentLevel);
        
        Debug.Log($"Level Up! Now level {currentLevel}");
    }
    
    private void CalculateXPRequirement()
    {
        // Exponential scaling: baseXP * (scaling ^ (level - 1))
        xpToNextLevel = {{BASE_XP_REQUIREMENT}} * Mathf.Pow({{XP_SCALING_FACTOR}}, currentLevel - 1);
    }
    
    private void RecalculateStats()
    {
        int levelsGained = currentLevel - {{STARTING_LEVEL}};
        
        currentStats.{{MAX_HEALTH}} = {{BASE_STATS}}.{{MAX_HEALTH}} + (levelsGained * {{HEALTH_PER_LEVEL}});
        currentStats.{{ATTACK_POWER}} = {{BASE_STATS}}.{{ATTACK_POWER}} + (levelsGained * {{ATTACK_PER_LEVEL}});
        currentStats.{{DEFENSE}} = {{BASE_STATS}}.{{DEFENSE}} + (levelsGained * {{DEFENSE_PER_LEVEL}});
        currentStats.{{MOVE_SPEED}} = {{BASE_STATS}}.{{MOVE_SPEED}} + (levelsGained * {{SPEED_PER_LEVEL}});
    }
    
    /// <summary>
    /// Get XP required for a specific level
    /// </summary>
    public float GetXPRequiredForLevel(int level)
    {
        return {{BASE_XP_REQUIREMENT}} * Mathf.Pow({{XP_SCALING_FACTOR}}, level - 1);
    }
    
    /// <summary>
    /// Get total XP required to reach a specific level from level 1
    /// </summary>
    public float GetTotalXPForLevel(int level)
    {
        float total = 0f;
        for (int i = 1; i < level; i++)
        {
            total += GetXPRequiredForLevel(i);
        }
        return total;
    }
    
    /// <summary>
    /// Save progression data
    /// </summary>
    public ProgressionData GetSaveData()
    {
        return new ProgressionData
        {
            level = currentLevel,
            xp = currentXP
        };
    }
    
    /// <summary>
    /// Load progression data
    /// </summary>
    public void LoadSaveData(ProgressionData data)
    {
        currentLevel = data.level;
        currentXP = data.xp;
        
        CalculateXPRequirement();
        RecalculateStats();
    }
}

[Serializable]
public class ProgressionData
{
    public int level;
    public float xp;
}

// Example UI Controller
public class XPUIController : MonoBehaviour
{
    [SerializeField] private XPSystem xpSystem;
    [SerializeField] private UnityEngine.UI.Slider xpBar;
    [SerializeField] private TMPro.TextMeshProUGUI levelText;
    [SerializeField] private TMPro.TextMeshProUGUI xpText;
    
    void Start()
    {
        if (xpSystem != null)
        {
            xpSystem.{{ON_LEVEL_UP}}.AddListener(OnLevelUp);
            xpSystem.{{ON_XP_GAINED}}.AddListener(OnXPGained);
            UpdateUI();
        }
    }
    
    void OnLevelUp(int newLevel)
    {
        UpdateUI();
        // Play level up effects, sound, etc.
    }
    
    void OnXPGained(float current, float required)
    {
        UpdateUI();
    }
    
    void UpdateUI()
    {
        if (levelText) levelText.text = $"Level {xpSystem.CurrentLevel}";
        if (xpText) xpText.text = $"{xpSystem.CurrentXP:F0} / {xpSystem.XPToNextLevel:F0}";
        if (xpBar) xpBar.value = xpSystem.XPProgress;
    }
}
`;

export const UNITY_XP_SYSTEM_CONFIG: MechanicsTemplate = {
    id: 'unity-xp-system',
    name: 'Unity XP & Leveling System',
    engine: 'unity',
    category: 'progression',
    language: 'csharp',
    code: UNITY_XP_SYSTEM_CODE,
    variables: [
        { name: 'STARTING_LEVEL', type: 'number', default: 1, description: 'Initial player level' },
        { name: 'MAX_LEVEL', type: 'number', default: 50, description: 'Maximum achievable level' },
        { name: 'BASE_XP_REQUIREMENT', type: 'number', default: 100, description: 'XP needed for level 2' },
        { name: 'XP_SCALING_FACTOR', type: 'number', default: 1.5, description: 'Exponential XP scaling per level' },
        { name: 'BASE_STATS', type: 'string', default: 'baseStats', description: 'Variable name for base stats' },
        { name: 'MAX_HEALTH', type: 'string', default: 'maxHealth', description: 'Health stat property name' },
        { name: 'ATTACK_POWER', type: 'string', default: 'attackPower', description: 'Attack stat property name' },
        { name: 'DEFENSE', type: 'string', default: 'defense', description: 'Defense stat property name' },
        { name: 'MOVE_SPEED', type: 'string', default: 'moveSpeed', description: 'Speed stat property name' },
        { name: 'HEALTH_PER_LEVEL', type: 'number', default: 10, description: 'Health increase per level' },
        { name: 'ATTACK_PER_LEVEL', type: 'number', default: 2, description: 'Attack increase per level' },
        { name: 'DEFENSE_PER_LEVEL', type: 'number', default: 1, description: 'Defense increase per level' },
        { name: 'SPEED_PER_LEVEL', type: 'number', default: 0.1, description: 'Speed increase per level' },
        { name: 'ON_LEVEL_UP', type: 'string', default: 'onLevelUp', description: 'Level up event name' },
        { name: 'ON_XP_GAINED', type: 'string', default: 'onXPGained', description: 'XP gained event name' }
    ],
    dependencies: [
        'Unity 2020.3+',
        'UnityEngine.Events',
        'TextMeshPro (for UI example)'
    ],
    instructions: `# Unity XP & Leveling System Setup

## 1. Create XP System GameObject
- Create empty GameObject: "XPSystem"
- Add XPSystem.cs script
- Configure in Inspector:
  - Starting Level: 1
  - Max Level: 50
  - Base XP Requirement: 100
  - XP Scaling Factor: 1.5 (each level needs 50% more XP)

## 2. Configure Base Stats
- Set base stats for level 1:
  - Max Health: 100
  - Attack Power: 10
  - Defense: 5
  - Move Speed: 5

## 3. Configure Stat Scaling
- Health Per Level: 10 (Level 10 = 190 health)
- Attack Per Level: 2
- Defense Per Level: 1
- Speed Per Level: 0.1

## 4. Setup UI (Optional)
- Create Canvas with:
  - Slider for XP bar
  - TextMeshPro for level display
  - TextMeshPro for XP text
- Add XPUIController script
- Reference XPSystem and UI elements

## 5. Usage in Code
\`\`\`csharp
// Award XP
xpSystem.AddXP(50f);

// Get current stats
float maxHealth = xpSystem.CurrentStats.maxHealth;
float attack = xpSystem.CurrentStats.attackPower;

// Listen for level ups
xpSystem.onLevelUp.AddListener((newLevel) => {
    Debug.Log($"Reached level {newLevel}!");
    // Heal player, play effects, etc.
});

// Save/Load
ProgressionData save = xpSystem.GetSaveData();
// ... save to file ...
xpSystem.LoadSaveData(save);
\`\`\`

## XP Scaling Example
- Level 1→2: 100 XP
- Level 2→3: 150 XP  
- Level 3→4: 225 XP
- Level 10→11: ~3,800 XP

## Customization Ideas
- Different stat scaling curves
- Skill points on level up
- Level-based unlock systems
- Prestige/rebirth mechanics
`,
    version: '1.0.0',
    tags: ['progression', 'xp', 'leveling', 'stats', 'rpg']
};
