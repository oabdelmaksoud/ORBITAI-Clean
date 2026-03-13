/**
 * Unity Quest System Template
 * Complete quest tracking with objectives, rewards, and progression
 */

import type { MechanicsTemplate } from '../../../types/gameMechanics.types.js';

export const UNITY_QUEST_SYSTEM_CODE = `using UnityEngine;
using UnityEngine.Events;
using System;
using System.Collections.Generic;
using System.Linq;

[Serializable]
public class QuestObjective
{
    public string {{OBJECTIVE_ID}};
    public string {{DESCRIPTION}};
    public ObjectiveType {{TYPE}};
    public int {{TARGET_COUNT}};
    public int {{CURRENT_COUNT}};
    public bool {{IS_COMPLETE}} => {{CURRENT_COUNT}} >= {{TARGET_COUNT}};
    
    public enum ObjectiveType { Collect, Defeat, Interact, Reach, Custom }
}

[Serializable]
public class QuestReward
{
    public int {{XP_REWARD}};
    public int {{GOLD_REWARD}};
    public List<string> {{ITEM_REWARDS}} = new List<string>();
}

[Serializable]
public class Quest
{
    public string {{QUEST_ID}};
    public string {{QUEST_NAME}};
    public string {{DESCRIPTION}};
    public QuestStatus {{STATUS}};
    public List<QuestObjective> {{OBJECTIVES}} = new List<QuestObjective>();
    public QuestReward {{REWARDS}};
    public int {{LEVEL_REQUIREMENT}};
    public List<string> {{PREREQUISITE_QUESTS}} = new List<string>();
    
    public enum QuestStatus { NotStarted, Active, Completed, Failed }
    
    public bool AllObjectivesComplete =>
        {{OBJECTIVES}}.All(obj => obj.{{IS_COMPLETE}});
}

public class QuestSystem : MonoBehaviour
{
    [Header("Quest Settings")]
    [SerializeField] private int {{MAX_ACTIVE_QUESTS}} = 5;
    
    [Header("Events")]
    public UnityEvent<Quest> {{ON_QUEST_STARTED}};
    public UnityEvent<Quest> {{ON_QUEST_COMPLETED}};
    public UnityEvent<Quest> {{ON_QUEST_FAILED}};
    public UnityEvent<Quest, QuestObjective> {{ON_OBJECTIVE_UPDATED}};
    public UnityEvent<Quest, QuestObjective> {{ON_OBJECTIVE_COMPLETED}};
    
    // Storage
    private List<Quest> availableQuests = new List<Quest>();
    private List<Quest> activeQuests = new List<Quest>();
    private List<Quest> completedQuests = new List<Quest>();
    
    // Properties
    public List<Quest> AvailableQuests => new List<Quest>(availableQuests);
    public List<Quest> ActiveQuests => new List<Quest>(activeQuests);
    public List<Quest> CompletedQuests => new List<Quest>(completedQuests);
    public int ActiveQuestCount => activeQuests.Count;
    
    /// <summary>
    /// Register a quest to be available
    /// </summary>
    public void RegisterQuest(Quest quest)
    {
        if (availableQuests.Any(q => q.{{QUEST_ID}} == quest.{{QUEST_ID}}))
        {
            Debug.LogWarning($"Quest {quest.{{QUEST_ID}}} already registered");
            return;
        }
        
        quest.{{STATUS}} = Quest.QuestStatus.NotStarted;
        availableQuests.Add(quest);
    }
    
    /// <summary>
    /// Start a quest
    /// </summary>
    public bool StartQuest(string questId, int playerLevel)
    {
        var quest = availableQuests.FirstOrDefault(q => q.{{QUEST_ID}} == questId);
        
        if (quest == null)
        {
            Debug.LogWarning($"Quest {questId} not found");
            return false;
        }
        
        // Check level requirement
        if (playerLevel < quest.{{LEVEL_REQUIREMENT}})
        {
            Debug.LogWarning($"Player level {playerLevel} too low for quest (requires {quest.{{LEVEL_REQUIREMENT}}})");
            return false;
        }
        
        // Check prerequisites
        if (!quest.{{PREREQUISITE_QUESTS}}.All(prereq => 
            completedQuests.Any(c => c.{{QUEST_ID}} == prereq)))
        {
            Debug.LogWarning("Quest prerequisites not met");
            return false;
        }
        
        // Check active quest limit
        if (activeQuests.Count >= {{MAX_ACTIVE_QUESTS}})
        {
            Debug.LogWarning("Too many active quests");
            return false;
        }
        
        // Start quest
        quest.{{STATUS}} = Quest.QuestStatus.Active;
        availableQuests.Remove(quest);
        activeQuests.Add(quest);
        
        {{ON_QUEST_STARTED}}?.Invoke(quest);
        
        return true;
    }
    
    /// <summary>
    /// Update quest objective progress
    /// </summary>
    public void UpdateObjective(string questId, string objectiveId, int amount = 1)
    {
        var quest = activeQuests.FirstOrDefault(q => q.{{QUEST_ID}} == questId);
        
        if (quest == null)
        {
            Debug.LogWarning($"Active quest {questId} not found");
            return;
        }
        
        var objective = quest.{{OBJECTIVES}}.FirstOrDefault(o => o.{{OBJECTIVE_ID}} == objectiveId);
        
        if (objective == null)
        {
            Debug.LogWarning($"Objective {objectiveId} not found in quest {questId}");
            return;
        }
        
        if (objective.{{IS_COMPLETE}})
        {
            return; // Already complete
        }
        
        objective.{{CURRENT_COUNT}} = Mathf.Min(
            objective.{{CURRENT_COUNT}} + amount,
            objective.{{TARGET_COUNT}}
        );
        
        {{ON_OBJECTIVE_UPDATED}}?.Invoke(quest, objective);
        
        if (objective.{{IS_COMPLETE}})
        {
            {{ON_OBJECTIVE_COMPLETED}}?.Invoke(quest, objective);
            
            // Check if all objectives complete
            if (quest.AllObjectivesComplete)
            {
                CompleteQuest(questId);
            }
        }
    }
    
    /// <summary>
    /// Complete a quest and grant rewards
    /// </summary>
    public void CompleteQuest(string questId)
    {
        var quest = activeQuests.FirstOrDefault(q => q.{{QUEST_ID}} == questId);
        
        if (quest == null)
        {
            Debug.LogWarning($"Active quest {questId} not found");
            return;
        }
        
        if (!quest.AllObjectivesComplete)
        {
            Debug.LogWarning("Cannot complete quest - objectives not finished");
            return;
        }
        
        // Update status
        quest.{{STATUS}} = Quest.QuestStatus.Completed;
        activeQuests.Remove(quest);
        completedQuests.Add(quest);
        
        // Grant rewards would be handled by listening to event
        {{ON_QUEST_COMPLETED}}?.Invoke(quest);
        
        Debug.Log($"Quest completed: {quest.{{QUEST_NAME}}}");
    }
    
    /// <summary>
    /// Fail a quest
    /// </summary>
    public void FailQuest(string questId)
    {
        var quest = activeQuests.FirstOrDefault(q => q.{{QUEST_ID}} == questId);
        
        if (quest == null)
        {
            Debug.LogWarning($"Active quest {questId} not found");
            return;
        }
        
        quest.{{STATUS}} = Quest.QuestStatus.Failed;
        activeQuests.Remove(quest);
        
        {{ON_QUEST_FAILED}}?.Invoke(quest);
    }
    
    /// <summary>
    /// Abandon an active quest
    /// </summary>
    public void AbandonQuest(string questId)
    {
        var quest = activeQuests.FirstOrDefault(q => q.{{QUEST_ID}} == questId);
        
        if (quest == null)
        {
            Debug.LogWarning($"Active quest {questId} not found");
            return;
        }
        
        quest.{{STATUS}} = Quest.QuestStatus.NotStarted;
        
        // Reset objectives
        foreach (var objective in quest.{{OBJECTIVES}})
        {
            objective.{{CURRENT_COUNT}} = 0;
        }
        
        activeQuests.Remove(quest);
        availableQuests.Add(quest);
    }
    
    /// <summary>
    /// Get quest by ID
    /// </summary>
    public Quest GetQuest(string questId)
    {
        return availableQuests.FirstOrDefault(q => q.{{QUEST_ID}} == questId) ??
               activeQuests.FirstOrDefault(q => q.{{QUEST_ID}} == questId) ??
               completedQuests.FirstOrDefault(q => q.{{QUEST_ID}} == questId);
    }
    
    /// <summary>
    /// Check if quest is completed
    /// </summary>
    public bool IsQuestCompleted(string questId)
    {
        return completedQuests.Any(q => q.{{QUEST_ID}} == questId);
    }
    
    /// <summary>
    /// Get objective progress
    /// </summary>
    public float GetObjectiveProgress(string questId, string objectiveId)
    {
        var quest = GetQuest(questId);
        var objective = quest?.{{OBJECTIVES}}.FirstOrDefault(o => o.{{OBJECTIVE_ID}} == objectiveId);
        
        if (objective == null)
            return 0f;
        
        return (float)objective.{{CURRENT_COUNT}} / objective.{{TARGET_COUNT}};
    }
    
    /// <summary>
    /// Save quest data
    /// </summary>
    public QuestSystemData GetSaveData()
    {
        return new QuestSystemData
        {
            activeQuests = this.activeQuests,
            completedQuests = this.completedQuests.Select(q => q.{{QUEST_ID}}).ToList()
        };
    }
    
    /// <summary>
    /// Load quest data
    /// </summary>
    public void LoadSaveData(QuestSystemData data)
    {
        if (data.activeQuests != null)
        {
            activeQuests = data.activeQuests;
        }
        
        if (data.completedQuests != null)
        {
            foreach (var questId in data.completedQuests)
            {
                var quest = GetQuest(questId);
                if (quest != null && !completedQuests.Contains(quest))
                {
                    quest.{{STATUS}} = Quest.QuestStatus.Completed;
                    completedQuests.Add(quest);
                    availableQuests.Remove(quest);
                }
            }
        }
    }
}

[Serializable]
public class QuestSystemData
{
    public List<Quest> activeQuests;
    public List<string> completedQuests;
}
`;

export const UNITY_QUEST_SYSTEM_CONFIG: MechanicsTemplate = {
    id: 'unity-quest-system',
    name: 'Unity Quest System',
    engine: 'unity',
    category: 'progression',
    language: 'csharp',
    code: UNITY_QUEST_SYSTEM_CODE,
    variables: [
        { name: 'MAX_ACTIVE_QUESTS', type: 'number', default: 5, description: 'Maximum active quests' },
        { name: 'QUEST_ID', type: 'string', default: 'questId', description: 'Quest ID field' },
        { name: 'QUEST_NAME', type: 'string', default: 'questName', description: 'Quest name field' },
        { name: 'DESCRIPTION', type: 'string', default: 'description', description: 'Description field' },
        { name: 'STATUS', type: 'string', default: 'status', description: 'Quest status field' },
        { name: 'OBJECTIVES', type: 'string', default: 'objectives', description: 'Objectives list field' },
        { name: 'REWARDS', type: 'string', default: 'rewards', description: 'Rewards field' },
        { name: 'LEVEL_REQUIREMENT', type: 'string', default: 'levelRequirement', description: 'Level requirement field' },
        { name: 'PREREQUISITE_QUESTS', type: 'string', default: 'prerequisiteQuests', description: 'Prerequisites field' },
        { name: 'OBJECTIVE_ID', type: 'string', default: 'objectiveId', description: 'Objective ID field' },
        { name: 'TYPE', type: 'string', default: 'type', description: 'Objective type field' },
        { name: 'TARGET_COUNT', type: 'string', default: 'targetCount', description: 'Target count field' },
        { name: 'CURRENT_COUNT', type: 'string', default: 'currentCount', description: 'Current count field' },
        { name: 'IS_COMPLETE', type: 'string', default: 'isComplete', description: 'Complete flag field' },
        { name: 'XP_REWARD', type: 'string', default: 'xpReward', description: 'XP reward field' },
        { name: 'GOLD_REWARD', type: 'string', default: 'goldReward', description: 'Gold reward field' },
        { name: 'ITEM_REWARDS', type: 'string', default: 'itemRewards', description: 'Item rewards field' },
        { name: 'ON_QUEST_STARTED', type: 'string', default: 'onQuestStarted', description: 'Quest started event' },
        { name: 'ON_QUEST_COMPLETED', type: 'string', default: 'onQuestCompleted', description: 'Quest completed event' },
        { name: 'ON_QUEST_FAILED', type: 'string', default: 'onQuestFailed', description: 'Quest failed event' },
        { name: 'ON_OBJECTIVE_UPDATED', type: 'string', default: 'onObjectiveUpdated', description: 'Objective updated event' },
        { name: 'ON_OBJECTIVE_COMPLETED', type: 'string', default: 'onObjectiveCompleted', description: 'Objective completed event' }
    ],
    dependencies: [
        'Unity 2020.3+',
        'System.Linq'
    ],
    instructions: `# Unity Quest System Setup

## 1. Create Quest Manager
- Create GameObject: "QuestManager"
- Add QuestSystem.cs script
- Configure max active quests (default: 5)

## 2. Create Quest Data
\`\`\`csharp
var quest = new Quest
{
    questId = "find_sword",
    questName = "Find the Lost Sword",
    description = "Search the dungeon for the legendary sword",
    levelRequirement = 5,
    objectives = new List<QuestObjective>
    {
        new QuestObjective
        {
            objectiveId = "kill_goblins",
            description = "Defeat 10 goblins",
            type = QuestObjective.ObjectiveType.Defeat,
            targetCount = 10
        },
        new QuestObjective
        {
            objectiveId = "find_sword",
            description = "Find the sword",
            type = QuestObjective.ObjectiveType.Interact,
            targetCount = 1
        }
    },
    rewards = new QuestReward
    {
        xpReward = 500,
        goldReward = 100,
        itemRewards = new List<string> { "legendary_sword" }
    }
};

questSystem.RegisterQuest(quest);
\`\`\`

## 3. Usage Examples
\`\`\`csharp
// Start quest
questSystem.StartQuest("find_sword", playerLevel: 10);

// Update objective when goblin defeated
questSystem.UpdateObjective("find_sword", "kill_goblins", 1);

// Check progress
float progress = questSystem.GetObjectiveProgress("find_sword", "kill_goblins");

// Abandon quest
questSystem.AbandonQuest("find_sword");

// Check if completed
bool completed = questSystem.IsQuestCompleted("find_sword");
\`\`\`

## 4. Events and Rewards
\`\`\`csharp
questSystem.onQuestCompleted.AddListener((quest) => {
    // Grant rewards
    xpSystem.AddXP(quest.rewards.xpReward);
    goldSystem.Add(quest.rewards.goldReward);
    
    foreach (var itemId in quest.rewards.itemRewards)
    {
        inventory.AddItem(GetItem(itemId));
    }
    
    Debug.Log($"Quest completed: {quest.questName}");
});

questSystem.onObjectiveUpdated.AddListener((quest, objective) => {
    UpdateQuestUI(quest);
});
\`\`\`

## 5. Quest Chain Example
\`\`\`csharp
// Quest 1
var quest1 = new Quest { questId = "intro_quest", ... };

// Quest 2 requires Quest 1
var quest2 = new Quest 
{ 
    questId = "follow_up_quest",
    prerequisiteQuests = new List<string> { "intro_quest" },
    ...
};
\`\`\`
`,
    version: '1.0.0',
    tags: ['quests', 'objectives', 'progression', 'rpg', 'missions']
};
