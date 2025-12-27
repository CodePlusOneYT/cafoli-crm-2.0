{/* Overdue Leads Popup */}
<Dialog open={isOverduePopupOpen} onOpenChange={setIsOverduePopupOpen}>
  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Overdue Leads</DialogTitle>
      <DialogDescription>
        {overdueLeads.length} leads are overdue. Assign them to a user to resolve.
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      {overdueLeads.map((lead) => (
        <LeadCard
          key={lead._id}
          lead={lead}
          // ...
          onAssignToSelf={(id) => handleAssignToSelf(id)}
          onAssignToUser={(leadId, userId) => handleAssignToUser(leadId, userId)}
        />

        <span className="text-xs text-muted-foreground">
          {new Date(lead._creationTime).toLocaleString()}
        </span>
      ))}
    </div>
  </DialogContent>
</Dialog>