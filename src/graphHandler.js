import Vue from 'vue';
import './graph';
import axios from 'axios';
import qs from 'qs';

const parseTicketName = name => {
  const matches = name.match(
    /^(?:\[(?<complexityReal>\d+[.,]?\d*)\])? ?(?:\((?<complexityEstimation>\d+[.,]?\d*)\))?(?: ?)(?<name>.+)$/
  );
  if (!matches)
    return {
      name,
      complexityEstimation: null,
      complexityReal: null,
    };
  return {
    name: matches[3] ? matches[3] : '',
    complexityEstimation: matches[2] ? matches[2] : null,
    complexityReal: matches[1] ? matches[1] : null,
  };
};

window.graphHandler = new Vue({
  el: '#graphHandler',

  data: {
    currentParent: '',
    currentChild: '',
    currentAssignee: '',
    newTicketId: '',
    newTicketName: '',
    dataAsJson: '',
    ip: '',
    chatId: '',
  },

  methods: {
    addDependencyOrAssignee(child, parent, assignee) {
      if (!child) {
        return;
      }
      if (parent) {
        this.addDependency(parent, child);
      }
      if (assignee) {
        this.addAssignee(child, assignee);
      }
      this.currentAssignee = null;
      this.currentChild = null;
      this.currentParent = null;
    },

    addAssignee(ticketId, assignee) {
      this.addGraphAssignee(ticketId, assignee);
      window.trelloHandler.deleteAllLabels(ticketId);
      window.trelloHandler.addTrelloLabel(ticketId, assignee);
    },

    addDependency(parent, child) {
      this.addGraphDependency(parent, child);
      window.trelloHandler.addTrelloDependency(parent, child);
    },

    addGraphAssignee(ticketId, assignee) {
      const currentNode = window.myDiagram.model.findNodeDataForKey(ticketId);
      const ticketLabels = [{ name: assignee }];
      window.myDiagram.startTransaction('Add assignee');
      window.myDiagram.model.setDataProperty(
        currentNode,
        'labels',
        ticketLabels
      );
      window.myDiagram.commitTransaction('Add assignee');
    },

    addGraphDependency(parent, child) {
      window.myDiagram.startTransaction('Add dependency');
      window.myDiagram.model.addLinkData({
        from: parent,
        to: child,
      });
      window.myDiagram.commitTransaction('Add dependency');
    },

    addOrUpdateTicket({ ticketId, ticketName, ticketLabels }) {
      const currentNode = window.myDiagram.model.findNodeDataForKey(ticketId);
      const ticketInfo = parseTicketName(ticketName);
      if (currentNode == null) {
        window.myDiagram.startTransaction('Add ticket');
        const newTicket = {
          ...ticketInfo,
          key: ticketId,
          keyHashtag: `#${ticketId}`,
          isComplexityEstimationVisible: !!ticketInfo.complexityEstimation,
          isComplexityRealVisible: !!ticketInfo.complexityReal,
          labels: ticketLabels,
        };
        window.myDiagram.model.addNodeData(newTicket);
        window.myDiagram.commitTransaction('Add ticket');
      } else {
        window.myDiagram.startTransaction('Update ticket');
        window.myDiagram.model.setDataProperty(
          currentNode,
          'name',
          ticketInfo.name
        );
        window.myDiagram.model.setDataProperty(
          currentNode,
          'complexityEstimation',
          ticketInfo.complexityEstimation
        );
        window.myDiagram.model.setDataProperty(
          currentNode,
          'isComplexityEstimationVisible',
          !!ticketInfo.complexityEstimation
        );
        window.myDiagram.model.setDataProperty(
          currentNode,
          'isComplexityRealVisible',
          !!ticketInfo.complexityReal
        );
        window.myDiagram.model.setDataProperty(
          currentNode,
          'complexityReal',
          ticketInfo.complexityReal
        );
        window.myDiagram.model.setDataProperty(
          currentNode,
          'labels',
          ticketLabels
        );
        window.myDiagram.commitTransaction('Update ticket');
      }
    },

    removeTicket(ticketId) {
      const currentNode = window.myDiagram.findNodeForKey(ticketId);
      if (currentNode != null) {
        window.myDiagram.startTransaction('Remove ticket');
        window.myDiagram.remove(currentNode);
        window.myDiagram.commitTransaction('Remove ticket');
      }
    },

    getNodes() {
      return window.myDiagram.model.nodeDataArray;
    },

    saveData() {
      this.dataAsJson = window.myDiagram.model.toJson();
    },

    loadData() {
      window.myDiagram.model = window.go.Model.fromJson(this.dataAsJson);
    },

    sendToIp() {
      const dataAsJson = window.myDiagram.model.toJson();
      const vm = this;
      axios({
        method: 'post',
        url: `http://${vm.ip}:5035/submit`,
        data: qs.stringify({
          chatId: vm.chatId,
          jsonData: dataAsJson,
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
      });
    },
  },

  created() {
    const uri = window.location.href.split('?');
    if (uri.length === 2) {
      const vars = uri[1].split('&');
      const getVars = {};
      let tmp = '';
      vars.forEach(v => {
        tmp = v.split('=');
        if (tmp.length === 2) {
          const [key, val] = tmp;
          getVars[key] = val;
        }
      });
      if (getVars.ip !== undefined) {
        this.ip = getVars.ip;
      }
      if (getVars.chatId !== undefined) {
        this.chatId = getVars.chatId;
      }
    }
  },
});
