import os
import json
import numpy as np
from pymed import PubMed
import pandas as pd

def get_author_info(pub):
    '''
    extract relevant publication info per pubmed entry
    '''

    # remove non-entries
    authors = [a for a in pub['authors'] if a['lastname']]

    s = pd.Series(dict(
        authors = [f"{a['lastname']},{a['initials']}" for a in authors],
        affiliations = [a['affiliation'] for a in authors]
    ))
    return s


def retrieve_pubmed(pubmed_query):
    # init tool
    pubmed = PubMed(tool="pubmed", email="martinszyska@googlemail.com")
    # do the query and store in pandas df
    results = pd.DataFrame([res.toDict() for res in pubmed.query(pubmed_query, max_results=2000)])
    results = results.loc[:, ['title', 'abstract', 'journal',
       'publication_date', 'authors', 'doi']]
    # reduce authors to strings
    results.loc[:,['authors', 'affiliations']] = results.apply(get_author_info, axis=1)
    results = results.loc[:,['title', 'abstract', 'journal', 'publication_date', 'doi',
       'authors', 'affiliations']]
    return results


def get_author_pos(row):
    '''
    retrieve the relative author position in publication + number of authors
    '''
    authors = row['authors']
    n_authors = len(authors)
    # get volk position
    try:
        volk_pos = round([i for i, name in enumerate(authors) if name.startswith("Volk")][0] / n_authors, 2)
    except:
        volk_pos = -1
    try:
        reinke_pos = round([i for i, name in enumerate(authors) if name.startswith("Reinke")][0] / n_authors, 2)
    except:
        reinke_pos = -1
    row['volk_pos'] = volk_pos
    row['reinke_pos'] = reinke_pos
    row['n_authors'] = n_authors
    return row


def get_coauthor_df(pubrow):
    '''
    create df of all possible coauthor links
    
    '''
    authors = pubrow['authors']
    
    df = pd.DataFrame({"X":authors}).merge(
                        pd.DataFrame({"Y":authors}), how="cross"
                    ).query("X != Y")
    # order the columns alphabetically for easy removal
    df['A'] = np.where(df['X'] < df['Y'], df['X'], df['Y'])
    df['B'] = np.where(df['X'] > df['Y'], df['X'], df['Y'])
    df['date'] = pubrow['date']
    return df.loc[:, ['A', 'B', 'date']].drop_duplicates()


def get_coauthors(pubmed_df):
    '''
    create the pubmed link df
    '''
    
    coauthor_list = []
    # convert the authors list if it is stored as string
    try:
        pubmed_df.loc[:, "authors"] = pubmed_df["authors"].apply(eval)
    except:
        True
    pubmed_df['date'] = pd.DatetimeIndex(pubmed_df['publication_date']).year
    for i, pubrow in pubmed_df.iterrows():
        
        coauthor_list.append(get_coauthor_df(pubrow))
    
    coauthors = pd.concat(coauthor_list)
    # convert date to integer (easier)
    return coauthors


def get_nodes(ca_df, min_power=1, max_nodes=0):
    '''
    get a list of all authors in ca_df and compute:
        power: number of interactions
        first/last: first and last time of occurrence as a coauthor
    '''
    
    # merge both sides of the coauthors list for a df of entries
    left = ca_df.loc[:,['A', 'date']].rename({"A":"name"}, axis=1)
    right = ca_df.loc[:,['B', 'date']].rename({"B":"name"}, axis=1)
     # sort for name AND date to be able to apply first and last in the agg
    entries = pd.concat([left, right]) \
        .sort_values(['name', 'date'], ascending=[False, True]) \
        .reset_index(drop=True)
    
    # get the nodes after grouping by name
    # remove hierarchical column level date
    # bring back name as column and add the index as id column
    nodes = entries.groupby("name") \
                .agg({'date':['count', 'last']}) \
                .rename(columns={'count':'power'}) \
                .loc[:,'date'] \
                .sort_values('power', ascending=False) \
                .reset_index()
    nodes['group'] = 1
    # reduce nodes
    nodes = nodes.query("power >= @min_power")
    return nodes.iloc[:max_nodes,:] if max_nodes else nodes


def get_edges(ca_df, nodes, min_weight=1, max_edges=0, remove_stumps=True):
    '''
    compute the interactions between possibly reduced authors from ca_df and compute weight
    reduce the source and target to node_ids
    '''
        
    edges = ca_df.groupby(["A","B"]).size().reset_index(name="weight").sort_values("weight", ascending=False).reset_index(drop=True).query('weight >= @min_weight')

    edges = edges.rename({"A":"source", "B":"target"}, axis=1)
    
    # reduce the edges to current nodes
    # merge in source
    edges = edges.merge(nodes.loc[:,['name', 'id']], left_on="source", right_on="name").rename({'name':'in_source', 'id':'sourceID'}, axis=1) 
    # merge in target
    edges = edges.merge(nodes.loc[:,['name', 'id']], left_on="target", right_on="name").rename({'name':'in_target', 'id':'targetID'}, axis=1)
    # reduce to existing in left and right
    edges = edges.query("in_source == in_source and in_target == in_target").loc[:, ['sourceID', 'targetID', 'source', 'target','weight']]
    
    # reduce to max_edges if set
    if max_edges:
        print("Applying max_edges")
        edges = edges.sort_values("weight", ascending=False).loc[:max_edges]

    #reformat the ids
    for col in ['sourceID', 'targetID']:
        edges.loc[:, col] = edges.loc[:, col].astype(int)   
    
    if remove_stumps:
        # reduce the nodes to names in edges
        names = pd.concat([edges.loc[:, ['source']].rename({'source':'name'},axis=1), edges.loc[:, ['target']].rename({'target':'name'},axis=1)]).drop_duplicates()
        nodes = nodes.merge(names).loc[:, [ 'id', 'name', 'power', 'last', 'group']]
    # reduce columns
    edges = edges.loc[:,['sourceID', 'targetID', 'weight']].rename({"sourceID":"source", "targetID":"target"}, axis=1)
    
    return nodes, edges


def get_info(coauthors, nodes, edges):
    '''
    make info dictionary to send as json
    '''
    # {"min": int(coauthors['date'].min()), "max":int(coauthors['date'].max())}
    years = [int(coauthors['date'].min()), int(coauthors['date'].max())]
    node_info = nodes['power'].describe().astype(int).to_json()
    edge_info = edges['weight'].describe().astype(int).to_json()
    
    return dict(
        year=years,
        nodes=node_info,
        links=edge_info
    )

def retrieve_data(coauthor_df, node_ids, edge_ids, max_nodes=0, min_power=1, max_edges=0, min_weight=1, remove_stumps=True):
    '''
    get edges and nodes until a certain year and save as json
    '''

    # get the reduced nodes and apply node_ids for unique ids
    nodes = get_nodes(coauthor_df, max_nodes=max_nodes, min_power=min_power).merge(node_ids).loc[:, ["id", "name", "power", "last", "group"]]
    
    # get the edges and reduce nodes to shared by linkage
    nodes, edges = get_edges(coauthor_df, nodes, min_weight=min_weight, max_edges=max_edges, remove_stumps=remove_stumps)
    
    edges = edges.merge(edge_ids).loc[:, ['id', 'source', 'target', 'weight']]
    
    j_nodes = json.loads(nodes.to_json(orient="records"))
    j_edges = json.loads(edges.to_json(orient="records"))
    j_info = get_info(coauthor_df, nodes, edges)
    
    return {"nodes":j_nodes, "edges":j_edges, "info":j_info}



def analyse_pubmed(result_df, outfolder=".", max_nodes=0, min_power=1, max_edges=0, min_weight=1, past_years=25, remove_stumps=True):
    # results = pd.read_csv(pubmed_results, sep="\t")
    # print(f"Pubmed list {os.path.basename(pubmed_results)} loaded - aggregating coauthorship..")
    coauthor_df = get_coauthors(result_df)
    print("Done! - Retrieving nodes and edges..")

    # get the global nodes
    nodes = get_nodes(coauthor_df)
    # store the ids of the global nodes list for unique ids
    nodes = nodes.reset_index().rename({'index': 'id'}, axis=1).loc[:, ["id", "name", "power", "last", "group"]]
    node_ids = nodes.loc[:,['id', 'name']]

    # retrieve the global edges
    nodes, edges = get_edges(coauthor_df, nodes)
    # and apply indices
    edges = edges.reset_index().rename({"index":"id"}, axis=1).loc[:, ['id', 'source', 'target', 'weight']]
    edge_ids = edges.drop(columns="weight")


    #### Saving globals
    print("Done! - Saving nodes and edges as csv..")
    
    nodes.to_csv(os.path.join(outfolder, "pubmap_nodes.csv"), sep="\t", index=False)
    edges.to_csv(os.path.join(outfolder, "pubmap_edges.csv"), sep="\t", index=False)
    json_folder = os.path.join(outfolder, "pubmap")
    # save global infos
    info_file = os.path.join(json_folder, f"pubmap_info.json")
    with open(info_file, "w") as file:
        json.dump(get_info(coauthor_df, nodes, edges), file)

    print(f"Done! - Saving nodes and edges per year as json into ..{json_folder}..")
    
    for year in coauthor_df['date'].sort_values().unique():
        print(year)
        past_year = year - past_years
        ca_df = coauthor_df.query('@past_year <= date <= @year')
        data_json = retrieve_data(
            ca_df, node_ids, edge_ids,
            max_nodes=max_nodes, 
            min_power=min_power,
            max_edges=max_edges,
            min_weight=min_weight,
            remove_stumps=remove_stumps
        )
        # save to datapath
        json_file = os.path.join(json_folder, f"pubmap{year}.json")
        with open(json_file, "w") as file:
            json.dump(data_json, file)


    print("Finished!!")