# Status

```plantuml
state Tag_new as "New"
state Tag_active as "Active"
state Tag_lost as "Lost"
state Tag_inactive as "Inactive"

[*] -> Tag_new: creation
Tag_new -> Tag_active: Activation
Tag_active -u-> Tag_lost: Loss \n declaration
Tag_active -> Tag_inactive
Tag_inactive -> [*]

state Tag_found as "Found" {
  state In <<entryPoint>>
  state D_new as "New"
  state D_pending as "Pending"
  state D_active as "Active"
  state D_returned as "Returned"
  state D_recovered as "Recovered"
  state RecoveredOut <<exitPoint>>
  state RejectedOut <<entryPoint>>


  In -[#Red]-> D_new: Finder
  D_new  -r-> D_pending: status active
  D_new --> D_active: status lost
  D_pending -[#Blue]-> D_active: approve
  D_active -r[#Red]-> D_returned: Sent \nby finder
  D_returned -[#Blue]-> D_recovered: Received \nby owner 
  D_active -[#Blue]> D_recovered: Received \nby owner 
  D_recovered -> RecoveredOut  
  D_pending -[#Blue]-> RejectedOut: reject
}
Tag_lost -r[#Red]-> In: Discovered
RecoveredOut -u-> Tag_active: Recovered
RejectedOut --> Tag_active: not lost
```



## Discovery

// if new: user was not logged in: propose to resubmit the dscovery
// if pending: when tag status was not declared lost,
//    if owner: approve the lost status of tag
//    if finder: display info that owner has been notified
// if active: display instructions, propose to declare return (finder) or reception (owner)
// if closed: display status

