import {testsRootPath} from '@/__tests__/utils/constants';
import {pdfParseWithPdfReader} from '@/app/api/parse-pdf/functions'; // Adjust the path accordingly
import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';

function doesFileExist(filePath: string): boolean {
  return fs.existsSync(filePath);
}

describe('pdfParseWithPdfreader', (a) => {
  it('should correctly parse a two-column PDF', async () => {
    const pdfPath = path.join(
      testsRootPath,
      'api/fixtures/two-column-two-pages.pdf'
    );

    if (!doesFileExist(pdfPath)) {
      throw new Error(`File ${pdfPath} does not exist`);
    }

    const file = fs.readFileSync(pdfPath);

    const result = await pdfParseWithPdfReader({file, columnsNumber: 2});

    // Note: The "correct" text contains hyphens that should be removed but for now it's a close enough approximation.
    expect(result).toBe(
      `7.8.3 Commander. Loyal Viziers begin on Move and 
Battle. In battle as attacker, you deal an extra hit.
7.8.4 Despot. Loyal Viziers begin on Move and Build. 
Whenever you remove at least one enemy building 
or token in battle, you score one extra victory 
point (two in total, 3.2.1).
8. Woodland Alliance AA
8.1 Overview
The Woodland Alliance works to gain the sympathy of 
the various creatures of the Woodland who are dissatisfied 
with their present condition. Each time the Alliance 
places a sympathy token, they may score victory points. 
The more sympathy on the map they have, the more 
victory points they score. Gaining the sympathy of the 
people requires supporters. These supporters can also 
be put toward violent ends, inciting outright rebellion 
across the forest. When a revolt erupts, the Alliance will 
establish a base. Bases allow the Alliance to train officers,
 increasing their military flexibility.
8.2 Faction Rules and Abilities
8.2.1 Crafting. The Alliance crafts during Daylight by 
activating sympathy tokens.
8.2.2 Guerrilla War. As defender in battle, the Alliance 
will deal hits equal to the higher roll, and the attacker 
will deal hits equal to the lower roll.
8.2.3 The Supporters Stack. To take various actions, 
the Alliance spends supporters, which are cards 
on their Supporters stack. Supporters can only be 
spent for their suit and do not count against the 
Alliance’s hand size. Supporters are face down, 
but the Alliance may inspect them at any time. 
I Capacity. If the Alliance has no bases on the 
map, the Supporters stack can only hold up 
to five cards. If the Alliance would gain a supporter 
but the stack cannot hold it, that card 
is discarded. If any bases are on the map, the 
Supporters stack can hold unlimited cards.
8.2.4 Removing Bases. Whenever a base is removed, 
the Alliance must discard all supporters matching 
the printed suit of the base (including birds) and remove 
half of their officers, rounded up. If the Alliance 
has no more bases on the map and has more 
than five supporters, they must discard down to 
five supporters. 
8.2.5 Sympathy Tokens. The Alliance has 10 sympathy 
tokens.
I Placement Limits. A clearing can hold only 
one sympathy token. 
II Terms. A sympathetic clearing is one with a 
sympathy token. An unsympathetic clearing 
is one without a sympathy token.
8.2.6 Outrage. Whenever another player removes a 
sympathy token or moves any warriors into a sympathetic 
clearing, they must add one card matching 
the affected clearing from their hand to the 
7
Supporters stack. If they have no matching cards 
(including no birds), they must show their hand to 
the Alliance, and then the Alliance draws a card 
from the deck and adds it to the Supporters stack. 
8.3 Faction Setup
8.3.1 Step 1: Gather Warriors. Form a supply of 
10 warriors.
8.3.2 Step 2: Place Bases. Place 3 bases on the matching 
spaces in your Bases box.
8.3.3 Step 3: Fill Sympathy Track. Place 10 sympathy 
tokens on your Sympathy track.
8.3.4 Step 4: Gain Supporters. Draw 3 cards and place 
them face down on your Supporters stack.
8.4 Birdsong
Your Birdsong has two steps in the following order.
8.4.1 Revolt. Any number of times, you may take the 
Revolt action, as follows.
I Step 1: Choose Clearing. Choose a sympathetic 
clearing that matches a base on your faction 
board.
II Step 2: Spend Supporters. Spend two supporters 
matching the suit of the chosen clearing.
III Step 3: Resolve Effect. Remove all enemy pieces 
from the chosen clearing. Then, place the 
matching base there, and place warriors there 
equal to the number of sympathetic clearings 
matching the base’s printed suit. Finally, place 
one warrior in the Officers box. This warrior is 
now an officer. (Remember to score one victory 
point per token and building removed.)
8.4.2 Spread Sympathy. Any number of times, you may 
take the Spread Sympathy action, as follows.
I Step 1: Choose Clearing. Choose an unsympathetic 
clearing adjacent to a sympathetic 
clearing. If there are no sympathetic clearings, 
you may choose any clearing.
II Step 2: Spend Supporters. Spend supporters 
matching the suit of the chosen clearing. The 
number of supporters that must be spent is 
listed above the sympathy token. 
a Martial Law. You must spend another 
matching supporter if the target clearing 
has at least 3 warriors of another player, including 
warriors they are treating as their 
own for rule (Mercenaries, hirelings, etc.). 
III Step 3: Place and Score. Place a sympathy token 
in the chosen clearing. Score the victory points 
on the space uncovered on your faction board.
8.5 Daylight
You may take the following actions in any order and 
number.
8.5.1 Craft. You may activate sympathy tokens to craft 
a card from your hand. 
8.5.2 Mobilize. Add a card from your hand to the Supporters 
stack. 
8
8.5.3 Train. Spend a card whose suit matches the printed 
suit of a base on the map to place a warrior in 
the Officers box. This warrior is now an officer.
8.6 Evening
Your Evening has two steps in the following order.
8.6.1 Military Operations. You may take actions, as 
follows, up to your number of officers, in any order 
and number. 
I Move. Take one move.
II Battle. Initiate a battle.
III Recruit. Place a warrior in any clearing with 
a base.
IV Organize. Remove one Alliance warrior from 
an unsympathetic clearing, place a sympathy 
token there, and score the victory points listed 
on the space uncovered on your faction board.
8.6.2 Draw and Discard. Draw one card, plus one card 
per uncovered draw bonus. Then, if you have 
more than five cards in your hand, discard cards 
of your choice until you have five.
9. Vagabond VV
9.1 Overview
The Vagabond plays all sides of the conflict while going 
on quests to increase his renown throughout the wood. 
Each time the Vagabond improves his relationship 
with another faction, or removes a warrior belonging to 
a faction hostile toward him, he scores victory points. 
He can also complete quests to score victory points. To 
move and act effectively the Vagabond must manage his 
pack of items, expanding his selection by exploring the 
forest ruins and providing aid to other factions.
9.2 Faction Rules and Abilities
9.2.1 Crafting. The Vagabond exhausts H to craft. All 
of his H match the suit of his current clearing. If 
the Vagabond crafts an item, he may immediately 
take it, face up. 
9.2.2 Lone Wanderer. The Vagabond pawn is not a warrior 
(so he cannot rule a clearing or stop another player 
from ruling one). The Vagabond pawn cannot be 
removed from the map.
I Full Removal. Whenever an enemy player uses 
an effect that says it removes all enemy pieces 
from a clearing (such as Alliance revolts, Favor of 
the Mice cards, Conspiracy bombs) with the Vagabond,
 the Vagabond damages three items.
9.2.3 Nimble. The Vagabond can move regardless of 
who rules his origin or destination clearing (4.2.1). 
9.2.4 Defenseless. In battle, the Vagabond is defenseless 
(4.3.2.III) if he has no undamaged S. 
9.2.5 Items. The Vagabond’s capabilities depend on the 
items he acquires. Instead of a Crafted Items box, 
he has a Satchel and various item tracks. Items on 
the Vagabond’s faction board can be face up or 
face down. The Vagabond exhausts face-up undamaged 
items, flipping them face down, to take 
many actions. 
I Item Tracks. When gained or flipped face up in 
the Satchel, T, X, and B are placed face up on 
their matching tracks. When flipped face down, 
T, X, or B on tracks are placed face down 
in the Satchel. Each track can only hold three 
matching items.
II The Satchel. When gained, M, S, C, F, and 
H are placed face up in the Vagabond’s Satchel.
9.2.6 Maximum Rolled Hits. In battle, the Vagabond’s 
maximum rolled hits (4.3.2.I) equals his undamaged 
S, face up or face down, in his Satchel.
9.2.7 Taking Hits. Whenever the Vagabond takes a hit 
(4.3.3), he must damage one undamaged item, 
moving it to his Damaged box. If no undamaged 
items remain to damage, the Vagabond ignores 
any remaining hits.
9.2.8 Dominance Cards and Coalitions. The Vagabond 
cannot activate a dominance card for its normal 
victory condition (3.3.1). Instead, in games with 
four or more players, the Vagabond can activate a 
dominance card to form a coalition with another 
player, placing his score marker on that player’s 
faction board. (The Vagabond no longer scores points.) 
That player must have fewer victory points than 
each other player except the Vagabond forming 
the coalition, and that player cannot be in a coalition.
 If there is a tie for fewest victory points, he 
chooses one tied player. If the coalitioned player 
wins the game, the Vagabond also wins.
9.2.9 Relationships. Your faction board shows a Relationships 
chart, which has four spaces on the Allied 
track and one Hostile box. It holds a relationship 
marker for each non-Vagabond faction.
I Improving Relationships. You can improve a 
relationship with a non-Hostile faction by taking 
the Aid action. 
a Cost. Aid a non-Hostile faction the number 
of times listed between their current Allied 
space and their next Allied space during the 
same turn. (A given Aid action counts toward 
only one improvement in relationship.)`
    );
  });

  it('should correctly parse a one-column PDF', async () => {
    const pdfPath = path.join(
      testsRootPath,
      'api/fixtures/single-column-four-pages.pdf'
    );

    if (!doesFileExist(pdfPath)) {
      throw new Error(`File ${pdfPath} does not exist`);
    }

    const file = fs.readFileSync(pdfPath);

    const result = await pdfParseWithPdfReader({file, columnsNumber: 1});

    // Note: It has some extra spaces but that's not an issue. Improving it further probably offers almost no gain.
    expect(result).toBe(
      `Leetcode cheatsheet 
Procedure 
1. Ask questions (edge cases, input sorted, negative values, length, memory 
considerations, is string comparison case sensitive, etc.). 
2. Clarify you’ve understood the problem well (what’s the input and what’s being asked). 
3. Draw the problem. 
4. Come up with test cases that ensure 100% your solution works. 
a. NOTE: This is crucial, because if you miss important test cases you may code an 
approach that ends up not working and being rejected by the coding platform. 
 
5. Solve the problem in these steps: 
a. How does your brain do it? This sometimes gives you a good method. 
b. Brute force first, since sometimes you can optimize from there. Check 
Optimizations section. 
c. Exploit the logic of the problem (f.e. Container with most water problem). 
 
6. Think of at least 3 different ways to solve it. Try to check if you can use any of the 
approaches mentioned below. 
a. NOTE: Avoid being silent for too long and saying “I don’t know” without following 
up with a potential solution. You’re showing you can reason and find a way. 
b. NOTE: Start without premature optimization and optimize from there. Because 
sometimes an extra O(n) operation is very fast and simplifies the thinking a lot. 
c. NOTE: If your gut tells you it’s not going to work, try first finding another way. 
 
7. Code the edge cases guards (undefined input, etc.). 
a. NOTE: Be extra sure that your code covers all cases! Don’t fail the test because 
of a < instead of the correct <= in an if clause for example. 
8. Decide on a solution and code it, while talking about it. 
Approaches 
While or for loop: O(n) 
- When dealing with more than one pointer use while loop. 
- If you have to manipulate the iteration pointer, use a for loop, it’s way easier to do. 
Recursion: O(n) / O(log(n)) / O(2^n) 
- Use it when you need to output one solution, if you need multiple solutions probably 
Backtracking is better. 
- Try it when you can identify a recurrent case (usually a mathematical formula). That is a 
subproblem you can solve over and over again until you reach an end condition, and 
then resolve bubbling up to the top. You can visualize it like a Tree data structure. 
- Useful when you don’t see any other way than testing all paths. 
- Problems: 
- Fibbonacci (easy): The recurrent case is fib(i) = fib(i-1) + fib(i-2) 
- House Robber (medium): The recurrent case is rob(i) = Math.max(rob(i - 
2) + currentHouseValue, rob(i - 1)) 
Linear Search: O(n) 
- Use to find a value in an unsorted Linked List or Array. 
Binary Search: O(log(n)) 
- Use it when input is sorted and you can choose left or right in all cases. 
Two Pointers: O(n) 
- Use when you have a solid logic for when to move the left or right pointer. 
- If the array is sorted it can be used too. 
- Problems: 
- Check palindromes. 
- Container with most water (medium and hard): To maximize water you need to 
move the lesser value pointer as the taller the walls the more water you can fit. 
- Maximum Product of Two Elements in an Array (easy): To find the biggest product 
you move the lesser value pointer as you maximize by maximizing both ends. 
Floyd’s Tortoise and Hare: O(n) 
- Use when detecting a cycle in a Linked List or a graph. 
Sliding Window: O(n) 
- Try it when you want a sequential portion of an array. 
- Try it when Two Pointers cannot be used, f.e. when you have negative numbers. 
- Problems: 
- Maximum Contiguous Subarray (medium): You can decide when to drop the left 
part of the subarray (when it sums less than zero). 
- Longest Substring Without Repeating Characters (medium): You drop the left 
part when you find a repeated character. 
Memoization: O(n) 
- Use when you can save previous work to avoid repeating it in the future. Usually your dp 
HashMap will have the key equal to the value of function parameters. 
- Use when you want to extend the range of possible values before a Stack Overflow error. 
- Use when you need to derive the solution from the memoized HashMap (bottom up). 
- Problems: 
- Fibbonacci: You calculate the value once for each value. 
- Coin Change (bottom-up and top-down): You calculate the amount value only 
once and can build from there. 
Backtracking: typically O(candidates^n) 
- Use it when you need to output more than one solution. If the problem asks for one 
solution you probably can use recursion + memoization instead. 
- Use when you have to test candidates for a solution and then decide if you discard the 
tested candidate or not before proceeding and returning a valid one. 
DFS: O(V + E) 
- Use when the input is a graph or tree 
- Preorder ➡️ 9, 4, 1, 6, 7, 20, 15, 16, 170 
- Use when needing to recreate the tree. 
 
- Inorder ➡️ 1, 4, 6, 7, 9, 15, 16, 20, 170 
- Useful to order a tree 
 
- Postorder ➡️ 1, 7, 6, 4, 16, 15, 170, 20, 9 
- Useful when wanting to get the smallest value. 
 
- Problems: 
- Find longest/deepest path in a BST. 
- Find the exit of a maze. 
BFS: O(V + E) 
- Use when the input is a graph or tree. 
- Problems: 
- Find shortest path. 
- Scan tree by levels. 
- Find highest values in a heap. 
Topological Sort (Graphs) 
- Use when you want to sort the nodes from less connection to them to more. 
- Use when wanting to detect a cycle in a Directed Graph. Since Topological Sort can only 
take nodes that have 0 incoming connections left if there’s a point where you can’t take 
a node to add to the sorted array it means there’s a cycle in there. 
- Problems: 
- Course Schedule (medium). 
Dijkstra: O(E log V) 
- Use when input is weighted graph. 
Sorting 
Check complexities in Big O Cheatsheet. Lowest possible best case Θ(n), average case is Θ(n 
log(n)). 
- Data is almost sorted ➡️ Insertion Sort. 
- Need Space complexity O(1) ➡️ Insertion Sort. 
- Need stable sorting ➡️ Merge Sort / Insertion Sort. 
- Need consistency in all cases ➡️ Merge Sort. 
- Need parallelization ➡️ Merge Sort. 
- Need the fastest sorting AND can choose a good pivot ➡️ Quick Sort. 
- Input is integers AND you know the min or max value ➡️ Radix/Counting sort. 
Optimizations 
- The output requested isn’t a data structure ➡️ Try a solution with space complexity 
O(1) by working on the same inputs instead of storing extra data. 
- You do a lot of repeated checks/calculations ➡️ Try memoization approach. 
- Have you tried iterating from behind? ➡️ No? Try it! 
- Return early when you can to save iterations. 
Tricks and code snippets 
- Clean a string only leaving alphanumeric characters (the ^ means not in sequence): 
string.replaceAll(/[^A-Za-z0-9]+/g,''). 
- If you want to pass counters to a recursive function you probably want to pass 
everything by value to maintain the correct counter at each recursive level. In the 
‘aabaabab’ Codility problem the correct signature was tryAddChar('a', 
Object.assign({}, prevChars), str, A, B).`
    );
  });

  it('should handle an empty PDF gracefully', async () => {
    const pdfPath = path.join(testsRootPath, 'api/fixtures/empty.pdf');

    if (!doesFileExist(pdfPath)) {
      throw new Error(`File ${pdfPath} does not exist`);
    }

    const file = fs.readFileSync(pdfPath);

    const result = await pdfParseWithPdfReader({file, columnsNumber: 1});

    // Expect result to be empty or handle gracefully
    expect(result).toBe('');
  });
});
